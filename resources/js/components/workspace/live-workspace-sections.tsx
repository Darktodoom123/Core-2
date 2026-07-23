import { router, useForm } from '@inertiajs/react';
import { Bot, Fuel, ShieldCheck, Truck, Users } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button, EmptyState, PageHeading, Panel } from '@/components/ui';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    AssetViewModel,
    AuditEventViewModel,
    FuelRequestViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

export function LiveWorkspaceSection({
    section,
    assets,
    fuelRequests,
    approvals,
    users,
    auditEvents,
    capabilities,
}: {
    section: Exclude<WorkspaceSection, 'dispatch'>;
    assets: AssetViewModel[];
    fuelRequests: FuelRequestViewModel[];
    approvals: ApprovalViewModel[];
    users: WorkspaceUserViewModel[];
    auditEvents: AuditEventViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    switch (section) {
        case 'assets':
            return <AssetsSurface assets={assets} />;
        case 'fuel':
            return (
                <FuelSurface
                    requests={fuelRequests}
                    capabilities={capabilities}
                />
            );
        case 'approvals':
            return (
                <ApprovalsSurface
                    approvals={approvals}
                    canDecide={capabilities.decide_approval}
                />
            );
        case 'users':
            return <UsersSurface users={users} />;
        case 'audit':
            return <AuditSurface events={auditEvents} />;
    }
}

function AssetsSurface({ assets }: { assets: AssetViewModel[] }) {
    return (
        <div>
            <PageHeading
                title="Fleet and equipment"
                description="Review live lifecycle state, current location, and unresolved maintenance blocks before assignment."
            />
            <div className="p-4 md:p-6">
                {assets.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Truck}
                            title="No assets available"
                            message="Assigned or organization-wide fleet and equipment will appear when your account can access them."
                        />
                    </Panel>
                ) : (
                    <ResponsiveTable
                        headers={[
                            'Code',
                            'Asset',
                            'Type',
                            'Status',
                            'Location',
                            'Safety blocks',
                        ]}
                        rows={assets.map((asset) => ({
                            key: asset.id,
                            cells: [
                                <span className="font-semibold">
                                    {asset.code}
                                </span>,
                                asset.name,
                                humanize(asset.kind),
                                <CanonicalStatusBadge status={asset.status} />,
                                asset.location ?? 'Location not reported',
                                asset.blocking_work_orders_count === 0 ? (
                                    <span className="text-success-strong">
                                        None
                                    </span>
                                ) : (
                                    <span className="font-medium text-danger">
                                        {asset.blocking_work_orders_count}{' '}
                                        unresolved
                                    </span>
                                ),
                            ],
                        }))}
                    />
                )}
            </div>
        </div>
    );
}

function FuelSurface({
    requests,
    capabilities,
}: {
    requests: FuelRequestViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const form = useForm({
        quantity_litres: '',
        fuel_type: 'diesel',
        purpose: '',
    });
    const formComplete =
        form.data.quantity_litres.trim() !== '' &&
        form.data.purpose.trim() !== '';

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/fuel-requests', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };
    const transition = (requestId: number, status: string) => {
        const actionId = `${requestId}:${status}`;
        router.post(
            `/operations/fuel-requests/${requestId}/status`,
            { status },
            {
                preserveScroll: true,
                onStart: () => setPendingAction(actionId),
                onFinish: () => setPendingAction(null),
            },
        );
    };

    return (
        <div>
            <PageHeading
                title="Fuel operations"
                description="Requests move through the canonical submitted, forwarded, approved, verified, and logged workflow."
            />
            <div className="space-y-5 p-4 md:p-6">
                {capabilities.request_fuel && (
                    <Panel className="p-4">
                        <h2 className="font-semibold">Submit fuel request</h2>
                        <p className="mt-1 text-sm text-ink-soft">
                            The request remains scoped to its authenticated
                            requester.
                        </p>
                        <form
                            onSubmit={submit}
                            className="mt-4 grid gap-4 md:grid-cols-[12rem_12rem_minmax(16rem,1fr)_auto]"
                            noValidate
                        >
                            <FuelInput
                                label="Litres"
                                type="number"
                                value={form.data.quantity_litres}
                                error={form.errors.quantity_litres}
                                onChange={(value) =>
                                    form.setData('quantity_litres', value)
                                }
                            />
                            <label className="text-sm font-medium">
                                Fuel type
                                <select
                                    value={form.data.fuel_type}
                                    onChange={(event) =>
                                        form.setData(
                                            'fuel_type',
                                            event.target.value,
                                        )
                                    }
                                    className="mt-1 h-11 w-full rounded-lg border border-line-strong bg-surface px-3"
                                >
                                    <option value="diesel">Diesel</option>
                                    <option value="gasoline">Gasoline</option>
                                </select>
                            </label>
                            <FuelInput
                                label="Purpose"
                                value={form.data.purpose}
                                error={form.errors.purpose}
                                onChange={(value) =>
                                    form.setData('purpose', value)
                                }
                            />
                            <div className="flex flex-col justify-end">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={form.processing || !formComplete}
                                >
                                    {form.processing
                                        ? 'Submitting…'
                                        : 'Submit request'}
                                </Button>
                            </div>
                        </form>
                    </Panel>
                )}

                <Panel className="overflow-hidden">
                    {requests.length === 0 ? (
                        <EmptyState
                            icon={Fuel}
                            title="No fuel requests available"
                            message={
                                capabilities.request_fuel
                                    ? 'Submit a request above when fuel is required for assigned work.'
                                    : 'Requests visible to your role will appear here.'
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {requests.map((request) => {
                                const nextAction = getFuelAction(
                                    request,
                                    capabilities,
                                );
                                const actionId = nextAction
                                    ? `${request.id}:${nextAction.status}`
                                    : null;

                                return (
                                    <li
                                        key={request.id}
                                        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold">
                                                    {request.reference}
                                                </p>
                                                <CanonicalStatusBadge
                                                    status={request.status}
                                                />
                                            </div>
                                            <p className="mt-1 text-sm text-ink-soft">
                                                {request.quantity_litres} L ·{' '}
                                                {humanize(request.fuel_type)} ·{' '}
                                                {request.purpose}
                                            </p>
                                            <p className="mt-1 text-xs text-ink-soft">
                                                Requested by{' '}
                                                {request.requester.name}
                                                {request.asset
                                                    ? ` · ${request.asset.code}`
                                                    : ''}
                                            </p>
                                        </div>
                                        {nextAction && actionId && (
                                            <Button
                                                variant="secondary"
                                                onClick={() =>
                                                    transition(
                                                        request.id,
                                                        nextAction.status,
                                                    )
                                                }
                                                disabled={
                                                    pendingAction !== null
                                                }
                                            >
                                                {pendingAction === actionId
                                                    ? `${nextAction.label}…`
                                                    : nextAction.label}
                                            </Button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    );
}

function ApprovalsSurface({
    approvals,
    canDecide,
}: {
    approvals: ApprovalViewModel[];
    canDecide: boolean;
}) {
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const decide = (approvalId: number, status: 'approved' | 'rejected') => {
        const actionId = `${approvalId}:${status}`;
        router.post(
            `/operations/approval-requests/${approvalId}/decision`,
            { status },
            {
                preserveScroll: true,
                onStart: () => setPendingAction(actionId),
                onFinish: () => setPendingAction(null),
            },
        );
    };

    return (
        <div>
            <PageHeading
                title="Pending approvals"
                description="Exceptional dispatch and assignment decisions remain independent, attributable, and server-authorized."
            />
            <div className="p-4 md:p-6">
                <Panel className="overflow-hidden">
                    {approvals.length === 0 ? (
                        <EmptyState
                            icon={ShieldCheck}
                            title="No approvals need attention"
                            message="Exceptional changes awaiting an independent decision will appear here."
                        />
                    ) : (
                        <ul className="divide-y divide-line">
                            {approvals.map((approval) => (
                                <li
                                    key={approval.id}
                                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold">
                                                {humanize(approval.kind)}
                                            </p>
                                            <CanonicalStatusBadge
                                                status={approval.status}
                                            />
                                        </div>
                                        <p className="mt-1 text-sm text-ink-soft">
                                            {approval.subject.reference} ·{' '}
                                            {formatDateTime(
                                                approval.created_at,
                                            )}
                                        </p>
                                    </div>
                                    {canDecide && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                onClick={() =>
                                                    decide(
                                                        approval.id,
                                                        'rejected',
                                                    )
                                                }
                                                disabled={
                                                    pendingAction !== null
                                                }
                                            >
                                                {pendingAction ===
                                                `${approval.id}:rejected`
                                                    ? 'Rejecting…'
                                                    : 'Reject request'}
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={() =>
                                                    decide(
                                                        approval.id,
                                                        'approved',
                                                    )
                                                }
                                                disabled={
                                                    pendingAction !== null
                                                }
                                            >
                                                {pendingAction ===
                                                `${approval.id}:approved`
                                                    ? 'Approving…'
                                                    : 'Approve request'}
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    );
}

function UsersSurface({ users }: { users: WorkspaceUserViewModel[] }) {
    return (
        <div>
            <PageHeading
                title="Users and roles"
                description="Operational users receive one canonical role; this Phase 1 surface is intentionally read-only."
            />
            <div className="p-4 md:p-6">
                {users.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Users}
                            title="No users available"
                            message="Operational users will appear after an administrator adds them."
                        />
                    </Panel>
                ) : (
                    <ResponsiveTable
                        headers={['Name', 'Email', 'Role', 'Status']}
                        rows={users.map((user) => ({
                            key: user.id,
                            cells: [
                                <span className="font-semibold">
                                    {user.name}
                                </span>,
                                user.email,
                                user.role_label ?? 'Unassigned',
                                <span
                                    className={
                                        user.is_active
                                            ? 'text-success-strong'
                                            : 'text-danger'
                                    }
                                >
                                    {user.is_active ? 'Active' : 'Suspended'}
                                </span>,
                            ],
                        }))}
                    />
                )}
            </div>
        </div>
    );
}

function AuditSurface({ events }: { events: AuditEventViewModel[] }) {
    return (
        <div>
            <PageHeading
                title="Audit trail"
                description="Approvals, overrides, state changes, and access decisions remain attributable."
            />
            <div className="p-4 md:p-6">
                {events.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Bot}
                            title="No audit events recorded"
                            message="Sensitive operational and access changes will appear here."
                        />
                    </Panel>
                ) : (
                    <ResponsiveTable
                        headers={['Time', 'Actor', 'Action', 'Reason']}
                        rows={events.map((event) => ({
                            key: event.id,
                            cells: [
                                formatDateTime(event.occurred_at),
                                event.actor?.name ?? 'System',
                                humanize(event.action),
                                event.reason ?? 'No reason recorded',
                            ],
                        }))}
                    />
                )}
            </div>
        </div>
    );
}

function ResponsiveTable({
    headers,
    rows,
}: {
    headers: string[];
    rows: Array<{ key: number; cells: ReactNode[] }>;
}) {
    return (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
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
                    {rows.map((row) => (
                        <tr key={row.key} className="border-t border-line">
                            {row.cells.map((cell, index) => (
                                <td key={headers[index]} className="px-4 py-3">
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

function FuelInput({
    label,
    value,
    onChange,
    error,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
}) {
    return (
        <label className="text-sm font-medium">
            {label}
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3',
                    error ? 'border-danger' : 'border-line-strong',
                )}
            />
            {error && (
                <span className="mt-1 block text-xs text-danger">{error}</span>
            )}
        </label>
    );
}

function getFuelAction(
    request: FuelRequestViewModel,
    capabilities: WorkspaceCapabilities,
) {
    if (capabilities.forward_fuel && request.status.value === 'submitted') {
        return { status: 'forwarded', label: 'Forward request' };
    }

    if (capabilities.approve_fuel && request.status.value === 'forwarded') {
        return { status: 'approved', label: 'Approve request' };
    }

    if (capabilities.verify_fuel && request.status.value === 'approved') {
        return { status: 'verified', label: 'Verify request' };
    }

    return null;
}

function humanize(value: string) {
    return value.replaceAll('_', ' ');
}

function formatDateTime(value: string | null) {
    if (value === null) {
        return 'Not recorded';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
