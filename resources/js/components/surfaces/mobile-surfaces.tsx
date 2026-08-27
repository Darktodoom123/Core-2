import {
    AlertTriangle,
    Bell,
    Camera,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleGauge,
    Clock3,
    ClipboardList,
    CloudOff,
    Home,
    Map,
    MapPin,
    Menu,
    Navigation,
    Play,
    Route,
    ShieldCheck,
    Signature,
    TriangleAlert,
    Truck,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import {
    Button,
    DataPair,
    EmptyState,
    InlineNotice,
    Panel,
    ProgressBar,
    StatusBadge,
    PrototypeSandboxBanner,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    AppSection,
    ConnectivityState,
    DispatchJob,
    FieldTask,
    PrototypeDispatchStatusLabel,
    UserRole,
} from '@/types/operations';
import { roleLabels } from '@/types/operations';

const driverNavigation: Array<[AppSection, string, typeof Home]> = [
    ['today', 'Home', Home],
    ['job', 'Jobs', ClipboardList],
    ['live', 'Route', Map],
    ['issues', 'Issues', AlertTriangle],
];

const operatorNavigation: Array<[AppSection, string, typeof Home]> = [
    ['today', 'Home', Home],
    ['job', 'Job', ClipboardList],
    ['tasks', 'Safety', ShieldCheck],
    ['issues', 'Issues', Wrench],
];

function MobileFrame({
    role,
    section,
    connectivity,
    queuedActions,
    onSectionChange,
    onConnectivityChange,
    onSync,
    children,
}: {
    role: UserRole;
    section: AppSection;
    connectivity: ConnectivityState;
    queuedActions: number;
    onSectionChange: (section: AppSection) => void;
    onConnectivityChange: (state: ConnectivityState) => void;
    onSync: () => void;
    children: React.ReactNode;
}) {
    const nav = role === 'driver' ? driverNavigation : operatorNavigation;

    return (
        <div className="min-h-[calc(100vh-4.5rem)] bg-[#e8edf2] px-0 py-0 md:p-6">
            <PrototypeSandboxBanner
                surfaceName="Field Mobile Web Simulation (Native App: packages/field-mobile)"
                className="mb-3 md:rounded-lg"
            />
            <div className="mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-[27rem] flex-col overflow-hidden bg-surface md:min-h-[50rem] md:rounded-2xl md:border md:border-line-strong md:shadow-lg">
                <header className="flex min-h-16 items-center gap-3 border-b border-line px-3">
                    <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-subtle"
                        aria-label="Open app menu"
                    >
                        <Menu className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="min-w-0 flex-1 text-center">
                        <p className="truncate text-sm font-semibold text-ink">
                            {roleLabels[role]}
                        </p>
                        <p className="mt-0.5 text-[0.6875rem] text-ink-soft">
                            Prototype field app
                        </p>
                    </div>
                    <button
                        type="button"
                        className="relative flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-subtle"
                        aria-label="Notifications, 2 unread"
                    >
                        <Bell className="h-5 w-5" aria-hidden="true" />
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
                    </button>
                </header>

                {connectivity === 'offline' && (
                    <div className="flex items-center gap-3 bg-warning-soft px-4 py-3 text-sm text-warning-strong">
                        <CloudOff
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                        />
                        <span className="flex-1">
                            Offline · {queuedActions} update
                            {queuedActions === 1 ? '' : 's'} queued
                        </span>
                        <button
                            type="button"
                            onClick={onSync}
                            className="min-h-9 rounded-lg px-2 font-semibold hover:bg-warning-soft"
                        >
                            Reconnect
                        </button>
                    </div>
                )}

                <div className="flex-1 scrollbar-thin overflow-y-auto bg-canvas">
                    {children}
                </div>

                <footer className="mobile-safe-bottom border-t border-line bg-surface px-2 pt-2">
                    <nav
                        className="grid grid-cols-4"
                        aria-label={`${roleLabels[role]} mobile navigation`}
                    >
                        {nav.map(([navSection, label, Icon]) => {
                            const active = section === navSection;

                            return (
                                <button
                                    key={navSection}
                                    type="button"
                                    onClick={() => onSectionChange(navSection)}
                                    className={cn(
                                        'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[0.6875rem] font-medium',
                                        active
                                            ? 'text-brand'
                                            : 'text-ink-soft hover:bg-surface-subtle hover:text-ink',
                                    )}
                                    aria-current={active ? 'page' : undefined}
                                >
                                    <Icon
                                        className="h-5 w-5"
                                        aria-hidden="true"
                                    />
                                    {label}
                                </button>
                            );
                        })}
                    </nav>
                </footer>
            </div>

            <div className="mx-auto mt-4 hidden max-w-[27rem] items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-xs text-ink-soft md:flex">
                <span>
                    Connection simulator: <strong>{connectivity}</strong>
                </span>
                <button
                    type="button"
                    onClick={() =>
                        onConnectivityChange(
                            connectivity === 'offline' ? 'online' : 'offline',
                        )
                    }
                    className="min-h-9 rounded-lg px-3 font-semibold text-brand hover:bg-brand-soft"
                >
                    {connectivity === 'offline'
                        ? 'Restore connection'
                        : 'Simulate offline'}
                </button>
            </div>
        </div>
    );
}

function MiniRouteMap() {
    return (
        <div className="relative h-48 overflow-hidden rounded-xl bg-[#eaf0f3]">
            <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 400 220"
                role="img"
                aria-label="Simulated route from the current location to North Service Road"
            >
                <rect width="400" height="220" fill="#eaf0f3" />
                {[
                    'M-20 50 C90 75 160 30 270 55 S360 80 430 48',
                    'M-20 142 C80 120 150 164 250 138 S350 122 430 152',
                    'M80 -20 C95 55 70 120 100 240',
                    'M250 -20 C230 70 280 130 250 240',
                ].map((path) => (
                    <path
                        key={path}
                        d={path}
                        fill="none"
                        stroke="#c6d0d8"
                        strokeWidth="5"
                        strokeLinecap="round"
                    />
                ))}
                <path
                    d="M55 178 C105 142 128 98 185 112 S275 80 338 44"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="7"
                    strokeLinecap="round"
                />
                <circle cx="55" cy="178" r="10" fill="#16a34a" />
                <circle
                    cx="338"
                    cy="44"
                    r="12"
                    fill="#dc2626"
                    stroke="white"
                    strokeWidth="4"
                />
            </svg>
            <span className="absolute right-3 bottom-3 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm">
                34 min · 18.2 km
            </span>
        </div>
    );
}

function MobileSectionTitle({
    title,
    subtitle,
}: {
    title: string;
    subtitle: string;
}) {
    return (
        <div className="px-4 pt-5 pb-3">
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                {title}
            </h1>
            <p className="mt-1 text-sm leading-5 text-ink-soft">{subtitle}</p>
        </div>
    );
}

function DriverSurface({
    section,
    job,
    connectivity,
    onAdvanceJob,
}: {
    section: AppSection;
    job: DispatchJob;
    connectivity: ConnectivityState;
    onAdvanceJob: (status: PrototypeDispatchStatusLabel) => void;
}) {
    const nextStatus: Partial<
        Record<PrototypeDispatchStatusLabel, PrototypeDispatchStatusLabel>
    > = {
        Scheduled: 'Dispatched',
        Dispatched: 'En route',
        'En route': 'Arrived',
        Arrived: 'In progress',
        'In progress': 'Completed',
    };
    const currentNext = nextStatus[job.status] ?? 'En route';

    if (section === 'live') {
        return (
            <div className="p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-semibold text-ink">
                            Route to job site
                        </h1>
                        <p className="mt-1 text-sm text-ink-soft">
                            {job.reference} · {job.site}
                        </p>
                    </div>
                    <StatusBadge status={job.status} />
                </div>
                <MiniRouteMap />
                <Panel className="mt-4 p-4">
                    <div className="flex items-start gap-3">
                        <Navigation
                            className="mt-0.5 h-5 w-5 shrink-0 text-brand"
                            aria-hidden="true"
                        />
                        <div>
                            <p className="font-semibold text-ink">
                                Arrive at North Service Road
                            </p>
                            <p className="mt-1 text-sm leading-5 text-ink-soft">
                                Enter through the east service lane and keep the
                                fire route clear.
                            </p>
                        </div>
                    </div>
                    <Button className="mt-4 w-full" variant="primary">
                        Open turn-by-turn navigation
                    </Button>
                </Panel>
                <InlineNotice tone="info" title="Location sharing is on">
                    Operations can see this device while the job is active.
                </InlineNotice>
            </div>
        );
    }

    if (section === 'issues') {
        return (
            <div>
                <MobileSectionTitle
                    title="Report an issue"
                    subtitle="Choose the issue that best explains what is blocking the job."
                />
                <div className="space-y-2 px-4 pb-6">
                    {[
                        ['Traffic or route obstruction', Route],
                        ['Vehicle problem', Truck],
                        ['Site access problem', MapPin],
                        ['Accident or safety incident', TriangleAlert],
                    ].map(([label, Icon]) => (
                        <button
                            key={String(label)}
                            type="button"
                            className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left hover:bg-surface-subtle"
                        >
                            <Icon
                                className="h-5 w-5 text-ink-soft"
                                aria-hidden="true"
                            />
                            <span className="flex-1 text-sm font-medium text-ink">
                                {String(label)}
                            </span>
                            <ChevronRight
                                className="h-4 w-4 text-muted"
                                aria-hidden="true"
                            />
                        </button>
                    ))}
                    <Button
                        className="mt-3 w-full"
                        onClick={() => onAdvanceJob('On hold')}
                    >
                        Place job on hold
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <MobileSectionTitle
                title={section === 'job' ? 'Job details' : 'Today’s assignment'}
                subtitle="Your next action and required field records are kept together."
            />
            <div className="space-y-3 px-4 pb-6">
                <Panel className="overflow-hidden">
                    <div className="flex items-center justify-between gap-3 bg-success-soft px-4 py-3 text-sm text-green-900">
                        <span className="font-semibold">{job.status}</span>
                        <span>{job.startTime}</span>
                    </div>
                    <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs text-ink-soft">
                                    {job.reference}
                                </p>
                                <h2 className="mt-1 text-lg font-semibold text-ink">
                                    {job.title}
                                </h2>
                            </div>
                            <StatusBadge status={job.priority} />
                        </div>
                        <div className="mt-4 flex items-start gap-3 rounded-lg bg-surface-subtle p-3">
                            <MapPin
                                className="mt-0.5 h-5 w-5 shrink-0 text-brand"
                                aria-hidden="true"
                            />
                            <div>
                                <p className="text-sm font-semibold text-ink">
                                    {job.site}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-ink-soft">
                                    {job.siteNote}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-xs text-ink-soft">
                                    Schedule
                                </p>
                                <p className="mt-1 font-medium text-ink">
                                    {job.startTime}–{job.endTime}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-ink-soft">Vehicle</p>
                                <p className="mt-1 font-medium text-ink">
                                    TR-02
                                </p>
                            </div>
                        </div>
                    </div>
                </Panel>

                <Panel className="p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs text-ink-soft">Next action</p>
                            <p className="mt-1 font-semibold text-ink">
                                Change status to {currentNext}
                            </p>
                        </div>
                        <Clock3
                            className="h-5 w-5 text-brand"
                            aria-hidden="true"
                        />
                    </div>
                    <Button
                        className="mt-4 w-full"
                        variant="primary"
                        onClick={() => onAdvanceJob(currentNext)}
                    >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Mark {currentNext}
                    </Button>
                </Panel>

                {section === 'job' && (
                    <>
                        <Panel className="p-4">
                            <h2 className="font-semibold text-ink">
                                Proof of delivery
                            </h2>
                            <p className="mt-1 text-sm leading-5 text-ink-soft">
                                Add completion photos and recipient confirmation
                                before closing the job.
                            </p>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <Button>
                                    <Camera
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Add photos
                                </Button>
                                <Button>
                                    <Signature
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
                                    Add signature
                                </Button>
                            </div>
                        </Panel>
                        <Panel className="p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-ink">
                                        Sync status
                                    </p>
                                    <p className="mt-1 text-sm text-ink-soft">
                                        {connectivity === 'online'
                                            ? 'All field records are synchronized.'
                                            : 'Updates are stored on this device.'}
                                    </p>
                                </div>
                                {connectivity === 'online' ? (
                                    <CheckCircle2
                                        className="h-5 w-5 text-success"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <CloudOff
                                        className="h-5 w-5 text-warning"
                                        aria-hidden="true"
                                    />
                                )}
                            </div>
                        </Panel>
                    </>
                )}
            </div>
        </div>
    );
}

function OperatorSurface({
    section,
    job,
    onAdvanceJob,
}: {
    section: AppSection;
    job: DispatchJob;
    onAdvanceJob: (status: PrototypeDispatchStatusLabel) => void;
}) {
    const [checks, setChecks] = useState<boolean[]>(
        Array.from({ length: 6 }, () => false),
    );
    const completeCount = checks.filter(Boolean).length;
    const safetyComplete = completeCount === checks.length;

    if (section === 'tasks') {
        const safetyItems = [
            'Outriggers and ground conditions checked',
            'Wire rope and hook inspected',
            'Load chart matches lift plan',
            'Rigging crew briefing completed',
            'Exclusion zone established',
            'Emergency stop tested',
        ];

        return (
            <div>
                <MobileSectionTitle
                    title="Pre-operation safety"
                    subtitle="Complete all six checks before starting the lift."
                />
                <div className="px-4 pb-6">
                    <Panel className="overflow-hidden">
                        <div className="border-b border-line p-4">
                            <ProgressBar
                                value={(completeCount / checks.length) * 100}
                                label={`${completeCount} of ${checks.length} checks complete`}
                            />
                        </div>
                        <div className="divide-y divide-line">
                            {safetyItems.map((item, index) => (
                                <label
                                    key={item}
                                    className="flex min-h-16 cursor-pointer items-start gap-3 p-4 hover:bg-surface-subtle"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checks[index]}
                                        onChange={() =>
                                            setChecks((current) =>
                                                current.map(
                                                    (value, itemIndex) =>
                                                        itemIndex === index
                                                            ? !value
                                                            : value,
                                                ),
                                            )
                                        }
                                        className="mt-0.5 h-5 w-5 accent-brand"
                                    />
                                    <span className="text-sm leading-5 text-ink">
                                        {item}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </Panel>
                    <Button
                        className="mt-4 w-full"
                        variant="primary"
                        disabled={!safetyComplete}
                        onClick={() => onAdvanceJob('In progress')}
                    >
                        <Play className="h-4 w-4" aria-hidden="true" />
                        Start lift operation
                    </Button>
                    {!safetyComplete && (
                        <p className="mt-2 text-center text-xs text-ink-soft">
                            Complete the remaining safety checks to continue.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (section === 'issues') {
        return (
            <div>
                <MobileSectionTitle
                    title="Equipment condition"
                    subtitle="Report defects before they become a safety or schedule risk."
                />
                <div className="space-y-3 px-4 pb-6">
                    <Panel className="p-4">
                        <label className="text-sm font-semibold text-ink">
                            Issue category
                            <select className="mt-2 h-11 w-full rounded-lg border border-line bg-surface px-3 font-normal text-ink">
                                <option>Hydraulics</option>
                                <option>Controls</option>
                                <option>Rigging</option>
                                <option>Safety device</option>
                            </select>
                        </label>
                        <label className="mt-4 block text-sm font-semibold text-ink">
                            What did you observe?
                            <textarea
                                className="mt-2 min-h-28 w-full resize-y rounded-lg border border-line bg-surface p-3 font-normal text-ink"
                                placeholder="Describe the symptom and when it occurred"
                            />
                        </label>
                        <Button className="mt-3 w-full">
                            <Camera className="h-4 w-4" aria-hidden="true" />
                            Add condition photos
                        </Button>
                    </Panel>
                    <Button
                        className="w-full"
                        variant="primary"
                        onClick={() => onAdvanceJob('On hold')}
                    >
                        Report issue and place on hold
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <MobileSectionTitle
                title={section === 'job' ? 'Lift job' : 'Today’s lift'}
                subtitle="Review site constraints, complete safety checks, and record equipment condition."
            />
            <div className="space-y-3 px-4 pb-6">
                <Panel className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs text-ink-soft">
                                {job.reference}
                            </p>
                            <h2 className="mt-1 text-lg font-semibold text-ink">
                                {job.title}
                            </h2>
                        </div>
                        <StatusBadge status={job.status} />
                    </div>
                    <div className="mt-4 rounded-lg bg-surface-subtle p-3">
                        <div className="flex items-start gap-3">
                            <MapPin
                                className="mt-0.5 h-5 w-5 shrink-0 text-brand"
                                aria-hidden="true"
                            />
                            <div>
                                <p className="text-sm font-semibold text-ink">
                                    {job.site}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-ink-soft">
                                    {job.siteNote}
                                </p>
                            </div>
                        </div>
                    </div>
                    <dl className="mt-3 divide-y divide-line">
                        <DataPair label="Crane" value="CR-250-04 · 250 ton" />
                        <DataPair label="Work window" value="07:30–15:30" />
                        <DataPair label="Crew" value="2-person rigging team" />
                    </dl>
                </Panel>

                <button
                    type="button"
                    className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left hover:bg-surface-subtle"
                >
                    <ShieldCheck
                        className="h-6 w-6 text-brand"
                        aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">
                            Safety checklist
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                            {completeCount} of 6 required checks
                        </p>
                    </div>
                    <ChevronRight
                        className="h-4 w-4 text-muted"
                        aria-hidden="true"
                    />
                </button>

                {section === 'job' && (
                    <Panel className="p-4">
                        <h2 className="font-semibold text-ink">Work record</h2>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button>
                                <Camera
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Add photos
                            </Button>
                            <Button>
                                <CircleGauge
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Hours
                            </Button>
                        </div>
                        <Button
                            className="mt-3 w-full"
                            variant="primary"
                            onClick={() => onAdvanceJob('Completed')}
                        >
                            Complete operation
                        </Button>
                    </Panel>
                )}
            </div>
        </div>
    );
}

export function FieldMobileApp({
    role,
    section,
    jobs,
    connectivity,
    queuedActions,
    onSectionChange,
    onConnectivityChange,
    onSync,
    onAdvanceJob,
}: {
    role: 'driver' | 'operator';
    section: AppSection;
    jobs: DispatchJob[];
    fieldTasks?: FieldTask[];
    connectivity: ConnectivityState;
    queuedActions: number;
    onSectionChange: (section: AppSection) => void;
    onConnectivityChange: (state: ConnectivityState) => void;
    onSync: () => void;
    onAdvanceJob: (jobId: string, status: PrototypeDispatchStatusLabel) => void;
    onAdvanceTask?: (taskId: string, status: FieldTask['status']) => void;
}) {
    const assignedJob =
        jobs.find((job) => job.reference === 'CON-1251') ?? jobs[0];

    return (
        <MobileFrame
            role={role}
            section={section}
            connectivity={connectivity}
            queuedActions={queuedActions}
            onSectionChange={onSectionChange}
            onConnectivityChange={onConnectivityChange}
            onSync={onSync}
        >
            {!assignedJob ? (
                <div>
                    <MobileSectionTitle
                        title="Assigned work"
                        subtitle="Today’s dispatch assignments and field status."
                    />
                    <div className="px-4 pb-6">
                        <Panel>
                            <EmptyState
                                compact
                                icon={ClipboardList}
                                title="No job assigned"
                                message="Your next field assignment will appear here after dispatch confirms it."
                            />
                        </Panel>
                    </div>
                </div>
            ) : role === 'driver' ? (
                <DriverSurface
                    section={section}
                    job={assignedJob}
                    connectivity={connectivity}
                    onAdvanceJob={(status) =>
                        onAdvanceJob(assignedJob.id, status)
                    }
                />
            ) : role === 'operator' ? (
                <OperatorSurface
                    section={section}
                    job={assignedJob}
                    onAdvanceJob={(status) =>
                        onAdvanceJob(assignedJob.id, status)
                    }
                />
            ) : null}
        </MobileFrame>
    );
}
