import {
    AlertCircle,
    Clock,
    FileQuestion,
    Lock,
    ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { FilterButton, FilterGroup } from '../manager/manager-ui';
import type {
    AccountSummary,
    CredentialSummary,
    RoleCount,
} from './admin-dashboard-model';

const VISIBLE_ROWS = 6;

type IssueFilter = 'all' | 'expired' | 'missing' | 'expiring' | 'suspended';

interface IssueRow {
    key: string;
    kind: Exclude<IssueFilter, 'all'>;
    name: string;
    detail: string;
    tab: 'accounts' | 'credentials';
}

const KIND: Record<
    IssueRow['kind'],
    { label: string; icon: LucideIcon; className: string }
> = {
    expired: {
        label: 'Expired',
        icon: AlertCircle,
        className: 'bg-danger-soft text-danger-strong',
    },
    missing: {
        label: 'No credential',
        icon: FileQuestion,
        className: 'bg-warning-soft text-warning-strong',
    },
    expiring: {
        label: 'Expiring',
        icon: Clock,
        className: 'bg-warning-soft text-warning-strong',
    },
    suspended: {
        label: 'Suspended',
        icon: Lock,
        className: 'bg-surface-subtle text-ink-soft',
    },
};

function credentialName(kind: string, type: string): string {
    const readableKind = kind.replace(/_/g, ' ');

    return type ? `${type} (${readableKind})` : readableKind;
}

function issueRows(
    credentials: CredentialSummary,
    accounts: AccountSummary,
): IssueRow[] {
    return [
        ...credentials.expired.map(({ user, credential }) => ({
            key: `expired-${user.id}-${credential.id}`,
            kind: 'expired' as const,
            name: user.name,
            detail: `${credentialName(credential.kind, credential.credential_type)} expired ${formatDate(credential.expires_at, 'date unknown')}`,
            tab: 'credentials' as const,
        })),
        ...credentials.missing.map((user) => ({
            key: `missing-${user.id}`,
            kind: 'missing' as const,
            name: user.name,
            detail: `${user.role_label ?? 'Operator'} · no current licence or certification on file`,
            tab: 'credentials' as const,
        })),
        ...credentials.expiring.map(({ user, credential }) => ({
            key: `expiring-${user.id}-${credential.id}`,
            kind: 'expiring' as const,
            name: user.name,
            detail: `${credentialName(credential.kind, credential.credential_type)} expires ${formatDate(credential.expires_at, 'date unknown')}`,
            tab: 'credentials' as const,
        })),
        ...accounts.suspended.map((user) => ({
            key: `suspended-${user.id}`,
            kind: 'suspended' as const,
            name: user.name,
            detail: user.suspended_at
                ? `Suspended ${formatDate(user.suspended_at)}`
                : 'Sign-in turned off',
            tab: 'accounts' as const,
        })),
    ];
}

export function AccessPanel({
    credentials,
    accounts,
    roles,
    canOpenUsers,
    onOpenUsers,
}: {
    credentials: CredentialSummary;
    accounts: AccountSummary;
    roles: RoleCount[];
    canOpenUsers: boolean;
    onOpenUsers: (tab: 'accounts' | 'credentials') => void;
}) {
    const [filter, setFilter] = useState<IssueFilter>('all');
    const [expanded, setExpanded] = useState(false);
    const rows = issueRows(credentials, accounts);
    const counts: Record<IssueFilter, number> = {
        all: rows.length,
        expired: credentials.expired.length,
        missing: credentials.missing.length,
        expiring: credentials.expiring.length,
        suspended: accounts.suspended.length,
    };
    const filtered =
        filter === 'all' ? rows : rows.filter((row) => row.kind === filter);
    const visible = expanded ? filtered : filtered.slice(0, VISIBLE_ROWS);
    const maxRole = Math.max(1, ...roles.map((role) => role.count));

    return (
        <section
            aria-labelledby="admin-access-heading"
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <div>
                    <h2
                        id="admin-access-heading"
                        className="text-sm font-semibold text-ink"
                    >
                        Access and credentials
                    </h2>
                    <p className="text-xs text-ink-soft">
                        Accounts and qualifications that block safe dispatch.
                    </p>
                </div>
                {rows.length > 0 && (
                    <FilterGroup label="Filter access issues">
                        {(
                            [
                                ['all', 'All'],
                                ['expired', 'Expired'],
                                ['missing', 'No credential'],
                                ['expiring', 'Expiring'],
                                ['suspended', 'Suspended'],
                            ] as const
                        )
                            .filter(([key]) => key === 'all' || counts[key] > 0)
                            .map(([key, label]) => (
                                <FilterButton
                                    key={key}
                                    label={label}
                                    count={counts[key]}
                                    pressed={filter === key}
                                    emphasis={
                                        key === 'expired' ? 'danger' : 'neutral'
                                    }
                                    onClick={() => {
                                        setFilter(key);
                                        setExpanded(false);
                                    }}
                                />
                            ))}
                    </FilterGroup>
                )}
            </div>

            {rows.length === 0 ? (
                <p className="flex items-center gap-2.5 px-4 py-4 text-sm text-ink-soft sm:px-5">
                    <ShieldCheck
                        className="size-4 shrink-0 text-success-strong"
                        aria-hidden="true"
                    />
                    Every active operator has a current credential and no
                    account is suspended.
                </p>
            ) : (
                <ul className="divide-y divide-line">
                    {visible.map((row) => {
                        const kind = KIND[row.kind];
                        const Icon = kind.icon;

                        return (
                            <li
                                key={row.key}
                                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <span
                                        className={cn(
                                            'grid size-7 shrink-0 place-items-center rounded-md',
                                            kind.className,
                                        )}
                                    >
                                        <Icon
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-ink">
                                            {row.name}
                                            <span
                                                className={cn(
                                                    'ml-2 rounded px-1.5 py-0.5 align-middle text-[11px] font-semibold',
                                                    kind.className,
                                                )}
                                            >
                                                {kind.label}
                                            </span>
                                        </p>
                                        <p className="truncate text-xs text-ink-soft">
                                            {row.detail}
                                        </p>
                                    </div>
                                </div>
                                {canOpenUsers && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenUsers(row.tab)}
                                        aria-label={`Review ${row.name}`}
                                        className="min-h-11 shrink-0 rounded-md px-2 text-xs font-semibold text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden md:min-h-9"
                                    >
                                        Review
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {filtered.length > VISIBLE_ROWS && (
                <div className="border-t border-line px-4 py-2 sm:px-5">
                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        className="min-h-11 text-xs font-semibold text-ink-soft hover:text-ink md:min-h-9"
                    >
                        {expanded
                            ? 'Show fewer'
                            : `Show all ${filtered.length}`}
                    </button>
                </div>
            )}

            <div className="border-t border-line px-4 py-4 sm:px-5">
                <h3 className="text-xs font-medium text-ink-soft">
                    Active accounts by role
                    {accounts.partial && ' (first 200 accounts)'}
                </h3>
                {roles.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-soft">
                        No active accounts.
                    </p>
                ) : (
                    <dl className="mt-3 space-y-2.5">
                        {roles.map((role) => (
                            <div
                                key={role.role}
                                className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm"
                            >
                                <dt className="truncate text-ink">
                                    {role.label}
                                </dt>
                                <div
                                    className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"
                                    aria-hidden="true"
                                >
                                    <div
                                        className="h-full rounded-full bg-ink-soft/60"
                                        style={{
                                            width: `${(role.count / maxRole) * 100}%`,
                                        }}
                                    />
                                </div>
                                <dd className="font-semibold text-ink tabular-nums">
                                    {role.count}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </section>
    );
}
