import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Bot,
    ClipboardList,
    Fuel,
    LogOut,
    MapPin,
    ShieldCheck,
    Truck,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

type Job = {
    id: number;
    reference: string;
    client: string;
    title: string;
    site: string;
    priority: string;
    status: string;
    scheduled_start: string | null;
    version: number;
    personnel_assignments: Array<{ user: { name: string } }>;
    asset_assignments: Array<{ asset: { code: string } }>;
};
type Asset = {
    id: number;
    code: string;
    name: string;
    kind: string;
    status: string;
    location: string | null;
    blocking_work_orders_count: number;
};
type FuelRequest = {
    id: number;
    reference: string;
    requester: { name: string };
    asset: { code: string } | null;
    quantity_litres: string;
    fuel_type: string;
    purpose: string;
    status: string;
};
type Approval = {
    id: number;
    kind: string;
    status: string;
    subject_id: number;
    created_at: string;
};
type WorkspaceUser = {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    roles: Array<{ name: string }>;
};
type AuditEvent = {
    id: number;
    action: string;
    actor: { name: string } | null;
    occurred_at: string;
    reason: string | null;
};
type Section = 'dispatch' | 'assets' | 'fuel' | 'approvals' | 'users' | 'audit';

export default function Workspace({
    jobs,
    assets,
    fuelRequests,
    approvals,
    users,
    auditEvents,
}: {
    jobs: Job[];
    assets: Asset[];
    fuelRequests: FuelRequest[];
    approvals: Approval[];
    users: WorkspaceUser[];
    auditEvents: AuditEvent[];
}) {
    const { auth } = usePage().props;
    const can = (permission: string) => auth.permissions.includes(permission);
    const navigation = [
        {
            id: 'dispatch' as const,
            label: 'Dispatch',
            icon: ClipboardList,
            show: can('dispatch.view_all') || can('dispatch.view_assigned'),
        },
        {
            id: 'assets' as const,
            label: 'Fleet & equipment',
            icon: Truck,
            show:
                can('fleet.view_all') ||
                can('fleet.view_assigned') ||
                can('equipment.view_all') ||
                can('equipment.view_assigned'),
        },
        {
            id: 'fuel' as const,
            label: 'Fuel',
            icon: Fuel,
            show: can('fuel.view_all') || can('fuel.view_own'),
        },
        {
            id: 'approvals' as const,
            label: 'Approvals',
            icon: ShieldCheck,
            show:
                approvals.length > 0 ||
                can('assignments.approve') ||
                can('dispatch.approve_priority'),
        },
        {
            id: 'users' as const,
            label: 'Users & roles',
            icon: Users,
            show: can('users.manage'),
        },
        {
            id: 'audit' as const,
            label: 'Audit trail',
            icon: Bot,
            show: can('audit.view'),
        },
    ].filter((item) => item.show);
    const [section, setSection] = useState<Section>(
        navigation[0]?.id ?? 'dispatch',
    );
    const dispatchForm = useForm({
        reference: '',
        client: '',
        title: '',
        site: '',
        scheduled_start: '',
        scheduled_end: '',
        priority: 'routine',
        requirements: [] as string[],
    });
    const fuelForm = useForm({
        quantity_litres: '',
        fuel_type: 'diesel',
        purpose: '',
    });

    const submitDispatch = (event: FormEvent) => {
        event.preventDefault();
        dispatchForm.post('/operations/dispatch-jobs', {
            onSuccess: () => {
                dispatchForm.reset();
                router.reload({ only: ['jobs'] });
            },
        });
    };
    const submitFuel = (event: FormEvent) => {
        event.preventDefault();
        fuelForm.post('/operations/fuel-requests', {
            onSuccess: () => {
                fuelForm.reset();
                router.reload({ only: ['fuelRequests'] });
            },
        });
    };
    const updateFuel = (id: number, status: string) =>
        router.post(
            `/operations/fuel-requests/${id}/status`,
            { status },
            {
                preserveScroll: true,
                onSuccess: () => router.reload({ only: ['fuelRequests'] }),
            },
        );
    const decideApproval = (id: number, status: string) =>
        router.post(
            `/operations/approval-requests/${id}/decision`,
            { status },
            {
                preserveScroll: true,
                onSuccess: () => router.reload({ only: ['approvals'] }),
            },
        );
    const shareLocation = () =>
        navigator.geolocation?.getCurrentPosition((position) =>
            router.post('/operations/locations', {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy_metres: position.coords.accuracy,
                captured_at: new Date(position.timestamp).toISOString(),
                sharing_enabled: true,
            }),
        );

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <Head title="Operations workspace" />
            <div className="md:grid md:min-h-screen md:grid-cols-[15.5rem_minmax(0,1fr)]">
                <aside className="bg-ink p-4 text-white md:sticky md:top-0 md:h-screen">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand font-semibold">
                            C2
                        </div>
                        <div>
                            <p className="text-sm font-semibold">
                                Core Transaction 2
                            </p>
                            <p className="text-xs text-white/60">
                                {auth.role_label}
                            </p>
                        </div>
                    </div>
                    <nav className="mt-4" aria-label="Operations modules">
                        <ul className="flex gap-1 overflow-x-auto md:block md:space-y-1">
                            {navigation.map(({ id, label, icon: Icon }) => (
                                <li key={id}>
                                    <button
                                        onClick={() => setSection(id)}
                                        className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${section === id ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <Icon
                                            className="h-4 w-4 shrink-0"
                                            aria-hidden="true"
                                        />
                                        {label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </aside>
                <main>
                    <header className="flex min-h-[4.5rem] items-center gap-3 border-b border-line bg-surface px-5 md:px-7">
                        <div>
                            <p className="text-sm font-medium">
                                {auth.user?.name}
                            </p>
                            <p className="text-xs text-ink-soft">
                                Authenticated operations access
                            </p>
                        </div>
                        <button
                            onClick={shareLocation}
                            disabled={!can('tracking.share_own')}
                            className="ml-auto hidden min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium disabled:hidden sm:flex"
                        >
                            <MapPin className="h-4 w-4" />
                            Share location
                        </button>
                        <button
                            onClick={() => router.post('/logout')}
                            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-subtle"
                            aria-label="Sign out"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </header>
                    <div className="p-5 md:p-7">
                        {section === 'dispatch' && (
                            <WorkspaceSection
                                title="Dispatch jobs"
                                description="Schedules and field status are scoped by your active assignments."
                            >
                                {can('dispatch.create') && (
                                    <form
                                        onSubmit={submitDispatch}
                                        className="mb-6 grid gap-3 rounded-xl border border-line p-4 md:grid-cols-2"
                                    >
                                        <Input
                                            label="Reference"
                                            value={dispatchForm.data.reference}
                                            onChange={(value) =>
                                                dispatchForm.setData(
                                                    'reference',
                                                    value,
                                                )
                                            }
                                        />
                                        <Input
                                            label="Client"
                                            value={dispatchForm.data.client}
                                            onChange={(value) =>
                                                dispatchForm.setData(
                                                    'client',
                                                    value,
                                                )
                                            }
                                        />
                                        <Input
                                            label="Job title"
                                            value={dispatchForm.data.title}
                                            onChange={(value) =>
                                                dispatchForm.setData(
                                                    'title',
                                                    value,
                                                )
                                            }
                                        />
                                        <Input
                                            label="Site"
                                            value={dispatchForm.data.site}
                                            onChange={(value) =>
                                                dispatchForm.setData(
                                                    'site',
                                                    value,
                                                )
                                            }
                                        />
                                        <Input
                                            label="Start"
                                            type="datetime-local"
                                            value={
                                                dispatchForm.data
                                                    .scheduled_start
                                            }
                                            onChange={(value) =>
                                                dispatchForm.setData(
                                                    'scheduled_start',
                                                    value,
                                                )
                                            }
                                        />
                                        <Input
                                            label="End"
                                            type="datetime-local"
                                            value={
                                                dispatchForm.data.scheduled_end
                                            }
                                            onChange={(value) =>
                                                dispatchForm.setData(
                                                    'scheduled_end',
                                                    value,
                                                )
                                            }
                                        />
                                        <label className="text-sm font-medium">
                                            Priority
                                            <select
                                                value={
                                                    dispatchForm.data.priority
                                                }
                                                onChange={(event) =>
                                                    dispatchForm.setData(
                                                        'priority',
                                                        event.target.value,
                                                    )
                                                }
                                                className="mt-1 h-11 w-full rounded-lg border border-line px-3"
                                            >
                                                <option value="routine">
                                                    Routine
                                                </option>
                                                <option value="priority">
                                                    Priority
                                                </option>
                                                <option value="emergency">
                                                    Emergency
                                                </option>
                                            </select>
                                        </label>
                                        <button
                                            disabled={dispatchForm.processing}
                                            className="min-h-11 self-end rounded-lg bg-brand px-4 text-sm font-semibold text-white"
                                        >
                                            Create dispatch
                                        </button>
                                    </form>
                                )}
                                <DataTable
                                    headers={[
                                        'Reference',
                                        'Job',
                                        'Schedule',
                                        'Priority',
                                        'Status',
                                        'Assignments',
                                    ]}
                                    rows={jobs.map((job) => [
                                        job.reference,
                                        `${job.client} — ${job.title}`,
                                        job.scheduled_start
                                            ? new Date(
                                                  job.scheduled_start,
                                              ).toLocaleString()
                                            : 'Not scheduled',
                                        job.priority,
                                        job.status,
                                        [
                                            ...job.personnel_assignments.map(
                                                (item) => item.user.name,
                                            ),
                                            ...job.asset_assignments.map(
                                                (item) => item.asset.code,
                                            ),
                                        ].join(', ') || 'Unassigned',
                                    ])}
                                    empty="No dispatch jobs are visible for your account."
                                />
                            </WorkspaceSection>
                        )}
                        {section === 'assets' && (
                            <WorkspaceSection
                                title="Fleet and equipment"
                                description="Maintenance blocks and inspection state remain visible before assignment."
                            >
                                <DataTable
                                    headers={[
                                        'Code',
                                        'Asset',
                                        'Type',
                                        'Status',
                                        'Location',
                                        'Safety blocks',
                                    ]}
                                    rows={assets.map((asset) => [
                                        asset.code,
                                        asset.name,
                                        asset.kind,
                                        asset.status,
                                        asset.location ?? 'Unknown',
                                        String(
                                            asset.blocking_work_orders_count,
                                        ),
                                    ])}
                                    empty="No assigned or organization-wide assets are visible."
                                />
                            </WorkspaceSection>
                        )}
                        {section === 'fuel' && (
                            <WorkspaceSection
                                title="Fuel operations"
                                description="Requests move through review, approval, verification, and logging as separate decisions."
                            >
                                {can('fuel.request') && (
                                    <form
                                        onSubmit={submitFuel}
                                        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line p-4"
                                    >
                                        <Input
                                            label="Litres"
                                            type="number"
                                            value={
                                                fuelForm.data.quantity_litres
                                            }
                                            onChange={(value) =>
                                                fuelForm.setData(
                                                    'quantity_litres',
                                                    value,
                                                )
                                            }
                                        />
                                        <Input
                                            label="Purpose"
                                            value={fuelForm.data.purpose}
                                            onChange={(value) =>
                                                fuelForm.setData(
                                                    'purpose',
                                                    value,
                                                )
                                            }
                                        />
                                        <button
                                            disabled={fuelForm.processing}
                                            className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white"
                                        >
                                            Submit request
                                        </button>
                                    </form>
                                )}
                                <div className="space-y-2">
                                    {fuelRequests.length === 0 ? (
                                        <EmptyState text="No fuel requests are visible." />
                                    ) : (
                                        fuelRequests.map((fuel) => (
                                            <div
                                                key={fuel.id}
                                                className="flex flex-wrap items-center gap-3 border-b border-line py-3 text-sm"
                                            >
                                                <div className="min-w-52 flex-1">
                                                    <p className="font-medium">
                                                        {fuel.reference} ·{' '}
                                                        {fuel.requester.name}
                                                    </p>
                                                    <p className="text-ink-soft">
                                                        {fuel.quantity_litres} L{' '}
                                                        {fuel.fuel_type} —{' '}
                                                        {fuel.purpose}
                                                    </p>
                                                </div>
                                                <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium">
                                                    {fuel.status}
                                                </span>
                                                {can('fuel.forward') &&
                                                    fuel.status ===
                                                        'submitted' && (
                                                        <ActionButton
                                                            label="Forward"
                                                            onClick={() =>
                                                                updateFuel(
                                                                    fuel.id,
                                                                    'forwarded',
                                                                )
                                                            }
                                                        />
                                                    )}
                                                {can('fuel.approve') &&
                                                    fuel.status ===
                                                        'forwarded' && (
                                                        <ActionButton
                                                            label="Approve"
                                                            onClick={() =>
                                                                updateFuel(
                                                                    fuel.id,
                                                                    'approved',
                                                                )
                                                            }
                                                        />
                                                    )}
                                                {can('fuel.verify') &&
                                                    fuel.status ===
                                                        'approved' && (
                                                        <ActionButton
                                                            label="Verify"
                                                            onClick={() =>
                                                                updateFuel(
                                                                    fuel.id,
                                                                    'verified',
                                                                )
                                                            }
                                                        />
                                                    )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </WorkspaceSection>
                        )}
                        {section === 'approvals' && (
                            <WorkspaceSection
                                title="Pending approvals"
                                description="Exceptional changes require an independent manager decision."
                            >
                                <div className="space-y-2">
                                    {approvals.length === 0 ? (
                                        <EmptyState text="There are no pending approvals." />
                                    ) : (
                                        approvals.map((approval) => (
                                            <div
                                                key={approval.id}
                                                className="flex items-center gap-3 border-b border-line py-3"
                                            >
                                                <div className="flex-1">
                                                    <p className="font-medium">
                                                        {approval.kind.replaceAll(
                                                            '_',
                                                            ' ',
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-ink-soft">
                                                        Dispatch #
                                                        {approval.subject_id}
                                                    </p>
                                                </div>
                                                <ActionButton
                                                    label="Reject"
                                                    onClick={() =>
                                                        decideApproval(
                                                            approval.id,
                                                            'rejected',
                                                        )
                                                    }
                                                />
                                                <ActionButton
                                                    label="Approve"
                                                    onClick={() =>
                                                        decideApproval(
                                                            approval.id,
                                                            'approved',
                                                        )
                                                    }
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </WorkspaceSection>
                        )}
                        {section === 'users' && (
                            <WorkspaceSection
                                title="Users and roles"
                                description="Operational users receive one canonical role; access changes revoke active sessions."
                            >
                                <DataTable
                                    headers={[
                                        'Name',
                                        'Email',
                                        'Role',
                                        'Status',
                                    ]}
                                    rows={users.map((user) => [
                                        user.name,
                                        user.email,
                                        user.roles[0]?.name ?? 'Unassigned',
                                        user.is_active ? 'Active' : 'Suspended',
                                    ])}
                                    empty="No users found."
                                />
                            </WorkspaceSection>
                        )}
                        {section === 'audit' && (
                            <WorkspaceSection
                                title="Audit trail"
                                description="Approvals, overrides, status changes, and access changes are attributable."
                            >
                                <DataTable
                                    headers={[
                                        'Time',
                                        'Actor',
                                        'Action',
                                        'Reason',
                                    ]}
                                    rows={auditEvents.map((event) => [
                                        new Date(
                                            event.occurred_at,
                                        ).toLocaleString(),
                                        event.actor?.name ?? 'System',
                                        event.action,
                                        event.reason ?? '—',
                                    ])}
                                    empty="No audit events have been recorded."
                                />
                            </WorkspaceSection>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

function WorkspaceSection({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section aria-labelledby="workspace-title">
            <h1
                id="workspace-title"
                className="text-2xl font-semibold tracking-[-0.02em]"
            >
                {title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                {description}
            </p>
            <div className="mt-6">{children}</div>
        </section>
    );
}
function Input({
    label,
    value,
    onChange,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
}) {
    return (
        <label className="min-w-44 flex-1 text-sm font-medium">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required
                className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3"
            />
        </label>
    );
}
function ActionButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="min-h-10 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-subtle"
        >
            {label}
        </button>
    );
}
function EmptyState({ text }: { text: string }) {
    return (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            {text}
        </p>
    );
}
function DataTable({
    headers,
    rows,
    empty,
}: {
    headers: string[];
    rows: string[][];
    empty: string;
}) {
    if (rows.length === 0) {
        return <EmptyState text={empty} />;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="bg-surface-subtle text-ink-soft">
                    <tr>
                        {headers.map((header) => (
                            <th key={header} className="px-4 py-3 font-medium">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index} className="border-t border-line">
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-4 py-3">
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
