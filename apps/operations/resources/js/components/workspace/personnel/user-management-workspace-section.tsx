import { usePage } from '@inertiajs/react';
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    KeyRound,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import {
    Button,
    EmptyState,
    FormField,
    Input,
    InlineNotice,
    Label,
    Modal,
    PageHeading,
    Panel,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
    WorkspaceCapabilities,
    WorkspaceUserViewModel,
} from '@/types/workspace';
import { PersonnelWorkspaceSection } from './personnel-workspace-section';

type AccountRole =
    'system_administrator' | 'operations_manager' | 'crane_operator';

type AccountUser = {
    id: number;
    name: string;
    username: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    suspended_at: string | null;
    email_otp_enabled: boolean;
    roles: Array<{ id?: number; name: string }>;
};

type AccountPaginator = {
    data: AccountUser[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

type AccountIndexResponse = {
    data: AccountPaginator;
    active_system_administrators: number;
};

type AccountMutationResponse = {
    data?: AccountUser;
    temporary_password?: string;
    message?: string;
};

type AccountError = Error & {
    fields?: Record<string, string>;
};

type SignInActivityEvent = {
    id: number;
    event_label: 'Signed in' | 'Signed out';
    device_label: string;
    device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown' | null;
    location: string;
    ip_address: string;
    occurred_at: string | null;
    occurred_at_human: string | null;
};

type SignInActivityResponse = {
    data: SignInActivityEvent[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};

type CreateAccountForm = {
    name: string;
    username: string;
    email: string;
    phone: string;
    role: AccountRole;
};

const ROLE_OPTIONS: Array<{ value: AccountRole; label: string }> = [
    { value: 'system_administrator', label: 'System Administrator' },
    { value: 'operations_manager', label: 'Operations Manager' },
    { value: 'crane_operator', label: 'Operator' },
];

const EMPTY_CREATE_FORM: CreateAccountForm = {
    name: '',
    username: '',
    email: '',
    phone: '',
    role: 'operations_manager',
};

const EMPTY_ACCOUNT_LIST: AccountUser[] = [];

function roleFor(account: AccountUser): string {
    return account.roles[0]?.name ?? '';
}

function roleLabel(role: string): string {
    return (
        ROLE_OPTIONS.find((option) => option.value === role)?.label ??
        (role
            ? role
                  .replaceAll('_', ' ')
                  .replace(/\b\w/g, (letter) => letter.toUpperCase())
            : 'No role assigned')
    );
}

function statusFor(account: AccountUser): 'Active' | 'Suspended' {
    return account.is_active && account.suspended_at === null
        ? 'Active'
        : 'Suspended';
}

function accountErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) {
        return fallback;
    }

    const fields = (error as AccountError).fields;
    const fieldMessage = fields
        ? Object.values(fields).find((message) => message.length > 0)
        : undefined;

    return fieldMessage ?? error.message;
}

function csrfToken(): string | null {
    return (
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? null
    );
}

async function requestJson<T>(
    url: string,
    method = 'GET',
    body?: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    const token = csrfToken();

    if (body) {
        headers.set('Content-Type', 'application/json');
    }

    if (token && method !== 'GET') {
        headers.set('X-CSRF-TOKEN', token);
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
        signal,
    });
    const payload = (await response.json().catch(() => null)) as
        | (T & {
              message?: string;
              errors?: Record<string, string | string[]>;
          })
        | null;

    if (!response.ok) {
        const fields = Object.fromEntries(
            Object.entries(payload?.errors ?? {}).map(([key, value]) => [
                key,
                Array.isArray(value) ? (value[0] ?? '') : value,
            ]),
        );
        const error = new Error(
            payload?.message ??
                'The account request could not be completed. Review the details and try again.',
        ) as AccountError;
        error.fields = fields;

        throw error;
    }

    if (payload === null) {
        throw new Error('The server returned an empty response.');
    }

    return payload;
}

function accountQuery(
    search: string,
    role: string,
    status: string,
    page: number,
): string {
    const params = new URLSearchParams();
    const normalizedSearch = search.trim();

    if (normalizedSearch) {
        params.set('search', normalizedSearch);
    }

    if (role) {
        params.set('role', role);
    }

    if (status) {
        params.set('status', status);
    }

    params.set('page', String(page));

    return '/operations/users?' + params.toString();
}

function useAccountList(search: string, role: string, status: string) {
    const [result, setResult] = useState<AccountPaginator | null>(null);
    const [activeSystemAdministrators, setActiveSystemAdministrators] =
        useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);

    const refresh = useCallback(() => {
        setReloadKey((current) => current + 1);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        const delay = search.trim() ? 250 : 0;

        const timer = window.setTimeout(() => {
            setLoading(true);
            setError(null);

            void requestJson<AccountIndexResponse>(
                accountQuery(search, role, status, page),
                'GET',
                undefined,
                controller.signal,
            )
                .then((response) => {
                    if (!active) {
                        return;
                    }

                    setResult(response.data);
                    setActiveSystemAdministrators(
                        response.active_system_administrators,
                    );
                    setError(null);
                })
                .catch((requestError: unknown) => {
                    if (!active || controller.signal.aborted) {
                        return;
                    }

                    setError(
                        requestError instanceof Error
                            ? requestError.message
                            : 'The account list could not be loaded.',
                    );
                })
                .finally(() => {
                    if (active) {
                        setLoading(false);
                    }
                });
        }, delay);

        return () => {
            active = false;
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [page, reloadKey, role, search, status]);

    return {
        result,
        activeSystemAdministrators,
        loading,
        error,
        page,
        setPage,
        refresh,
    };
}

function useSignInActivity(accountId: number, enabled: boolean) {
    const [pageState, setPageState] = useState({ accountId, page: 1 });
    const page = pageState.accountId === accountId ? pageState.page : 1;
    const [result, setResult] = useState<{
        accountId: number;
        data: SignInActivityResponse;
    } | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const refresh = useCallback(() => {
        setLoading(true);
        setError(null);
        setReloadKey((current) => current + 1);
    }, []);

    const setPage = useCallback(
        (nextPage: number) => {
            setLoading(true);
            setError(null);
            setPageState({ accountId, page: nextPage });
        },
        [accountId],
    );

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const controller = new AbortController();
        let active = true;

        void requestJson<SignInActivityResponse>(
            `/operations/users/${accountId}/sign-in-activity?page=${page}&per_page=10`,
            'GET',
            undefined,
            controller.signal,
        )
            .then((response) => {
                if (active) {
                    setResult({ accountId, data: response });
                }
            })
            .catch((requestError: unknown) => {
                if (!active || controller.signal.aborted) {
                    return;
                }

                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Sign-in activity could not be loaded.',
                );
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [accountId, enabled, page, reloadKey]);

    return {
        activity: result?.accountId === accountId ? result.data : null,
        loading,
        error,
        page,
        setPage,
        refresh,
    };
}

function SignInActivitySection({
    accountId,
    accountName,
    canViewAudit,
}: {
    accountId: number;
    accountName: string;
    canViewAudit: boolean;
}) {
    const { activity, loading, error, page, setPage, refresh } =
        useSignInActivity(accountId, canViewAudit);
    const firstEvent = activity?.total
        ? (activity.current_page - 1) * activity.per_page + 1
        : 0;
    const lastEvent = activity
        ? Math.min(activity.current_page * activity.per_page, activity.total)
        : 0;

    return (
        <section
            className="border-t border-line pt-4"
            aria-labelledby="account-sign-in-activity-heading"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3
                        id="account-sign-in-activity-heading"
                        className="font-semibold text-ink"
                    >
                        Sign-in activity
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                        Location is approximate from the sign-in IP. Browser
                        data may not identify an exact device model.
                    </p>
                </div>
                {canViewAudit && (
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={loading}
                        onClick={refresh}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Refresh
                    </Button>
                )}
            </div>

            {!canViewAudit ? (
                <p className="mt-3 text-sm text-ink-soft" role="note">
                    Audit permission is required to view account sign-in
                    activity.
                </p>
            ) : (
                <div className="mt-3">
                    {loading && !activity && (
                        <p
                            className="py-3 text-sm text-ink-soft"
                            role="status"
                            aria-live="polite"
                            aria-busy="true"
                        >
                            Loading sign-in activity…
                        </p>
                    )}

                    {error && (
                        <InlineNotice
                            tone="warning"
                            title="Sign-in activity could not be loaded"
                            role="alert"
                        >
                            <p>{error}</p>
                            <Button
                                className="mt-2"
                                size="sm"
                                variant="secondary"
                                onClick={refresh}
                            >
                                Try again
                            </Button>
                        </InlineNotice>
                    )}

                    {!loading && !error && activity?.data.length === 0 && (
                        <p className="py-3 text-sm text-ink-soft">
                            No sign-in activity has been recorded.
                        </p>
                    )}

                    {activity && activity.data.length > 0 && (
                        <>
                            <ol
                                className="divide-y divide-line border-y border-line"
                                aria-label={`${accountName} sign-in activity`}
                                aria-busy={loading}
                            >
                                {activity.data.map((event) => (
                                    <li
                                        key={event.id}
                                        className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium text-ink">
                                                {event.event_label}
                                            </p>
                                            <p className="mt-0.5 text-xs break-words text-ink-soft">
                                                <span className="font-medium text-ink">
                                                    Device:
                                                </span>{' '}
                                                {event.device_label}
                                                {event.device_type &&
                                                    event.device_type !==
                                                        'unknown' && (
                                                        <>
                                                            {' · '}
                                                            {event.device_type
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                                event.device_type.slice(
                                                                    1,
                                                                )}
                                                        </>
                                                    )}
                                            </p>
                                            <p className="mt-0.5 text-xs break-words text-ink-soft">
                                                <span className="font-medium text-ink">
                                                    Location:
                                                </span>{' '}
                                                <span>{event.location}</span>
                                                <span>
                                                    {' · IP: '}
                                                    {event.ip_address}
                                                </span>
                                            </p>
                                        </div>
                                        <time
                                            className="shrink-0 text-xs text-ink-soft"
                                            dateTime={
                                                event.occurred_at ?? undefined
                                            }
                                        >
                                            {event.occurred_at_human ??
                                                event.occurred_at ??
                                                'Time unavailable'}
                                        </time>
                                    </li>
                                ))}
                            </ol>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-ink-soft">
                                    Showing {firstEvent}–{lastEvent} of{' '}
                                    {activity.total} sign-in events
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        aria-label="Previous sign-in activity page"
                                        disabled={page <= 1 || loading}
                                        onClick={() => setPage(page - 1)}
                                    >
                                        <ChevronLeft
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                        Previous
                                    </Button>
                                    <span className="min-w-16 text-center text-xs text-ink-soft">
                                        Page {activity.current_page} of{' '}
                                        {activity.last_page}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        aria-label="Next sign-in activity page"
                                        disabled={
                                            page >= activity.last_page ||
                                            loading
                                        }
                                        onClick={() => setPage(page + 1)}
                                    >
                                        Next
                                        <ChevronRight
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}

function AccountStatus({ account }: { account: AccountUser }) {
    const status = statusFor(account);

    return (
        <span
            className={cn(
                'inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold',
                status === 'Active'
                    ? 'bg-success-soft text-success-strong'
                    : 'bg-surface-subtle text-ink-soft',
            )}
        >
            <span
                className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    status === 'Active' ? 'bg-success' : 'bg-muted',
                )}
                aria-hidden="true"
            />
            {status}
        </span>
    );
}

function AccountManagementSection({ canViewAudit }: { canViewAudit: boolean }) {
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showMobileDetail, setShowMobileDetail] = useState(false);
    const directoryHeadingRef = useRef<HTMLHeadingElement>(null);
    const detailBackButtonRef = useRef<HTMLButtonElement>(null);
    const previousMobileDetail = useRef(false);
    const {
        result,
        activeSystemAdministrators,
        loading,
        error,
        page,
        setPage,
        refresh,
    } = useAccountList(search, roleFilter, statusFilter);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [createFocusReturnTarget, setCreateFocusReturnTarget] =
        useState<HTMLElement | null>(null);
    const [createForm, setCreateForm] =
        useState<CreateAccountForm>(EMPTY_CREATE_FORM);
    const [createErrors, setCreateErrors] = useState<Record<string, string>>(
        {},
    );
    const [createError, setCreateError] = useState<string | null>(null);
    const [createPending, setCreatePending] = useState(false);
    const [roleSelection, setRoleSelection] = useState<{
        userId: number;
        role: string;
    } | null>(null);
    const [pendingAction, setPendingAction] = useState<
        'suspend' | 'reset-password' | null
    >(null);
    const [actionPending, setActionPending] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [revealedPassword, setRevealedPassword] = useState<{
        name: string;
        value: string;
    } | null>(null);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
    const currentUserId = usePage<{
        auth?: { user?: { id?: number } | null };
    }>().props.auth?.user?.id;

    const accounts = result?.data ?? EMPTY_ACCOUNT_LIST;
    const selectedAccount =
        accounts.find((account) => account.id === selectedUserId) ??
        accounts[0] ??
        null;

    useEffect(() => {
        const wasShowingDetail = previousMobileDetail.current;
        previousMobileDetail.current = showMobileDetail;

        if (
            wasShowingDetail === showMobileDetail ||
            !window.matchMedia?.('(max-width: 959px)').matches
        ) {
            return;
        }

        if (showMobileDetail) {
            detailBackButtonRef.current?.focus();
        } else {
            directoryHeadingRef.current?.focus();
        }
    }, [showMobileDetail]);
    const currentRole = selectedAccount ? roleFor(selectedAccount) : '';
    const selectedRole =
        selectedAccount && roleSelection?.userId === selectedAccount.id
            ? roleSelection.role
            : currentRole;

    const refreshAccountList = useCallback(() => {
        refresh();
    }, [refresh]);

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCreatePending(true);
        setCreateError(null);
        setCreateErrors({});
        setFeedback(null);
        setRevealedPassword(null);

        try {
            const response = await requestJson<AccountMutationResponse>(
                '/operations/users',
                'POST',
                {
                    ...createForm,
                    phone: createForm.phone.trim() || null,
                    generate_temp_password: true,
                },
            );

            setShowCreate(false);
            setCreateForm(EMPTY_CREATE_FORM);
            setRoleFilter('');
            setStatusFilter('');
            setSearch(response.data?.username ?? '');
            setPage(1);
            setSelectedUserId(response.data?.id ?? null);
            setShowMobileDetail(true);

            if (response.temporary_password) {
                setRevealedPassword({
                    name: response.data?.name ?? createForm.name,
                    value: response.temporary_password,
                });
            } else {
                setFeedback(
                    'Account created. The server did not return a temporary password.',
                );
            }

            refreshAccountList();
        } catch (requestError: unknown) {
            if (
                requestError &&
                typeof requestError === 'object' &&
                'fields' in requestError
            ) {
                setCreateErrors((requestError as AccountError).fields ?? {});
            }

            setCreateError(
                requestError instanceof Error
                    ? requestError.message
                    : 'The account could not be created.',
            );
        } finally {
            setCreatePending(false);
        }
    };

    const performAccessUpdate = async (
        body: Record<string, unknown>,
        successMessage: string,
    ) => {
        if (!selectedAccount) {
            return;
        }

        setActionPending(true);
        setActionError(null);
        setFeedback(null);
        setRevealedPassword(null);

        try {
            await requestJson<AccountMutationResponse>(
                '/operations/users/' + selectedAccount.id,
                'PATCH',
                body,
            );
            setFeedback(successMessage);
            setPendingAction(null);
            setShowMobileDetail(false);

            if (typeof body.role === 'string') {
                setRoleSelection({
                    userId: selectedAccount.id,
                    role: body.role,
                });
            }

            refreshAccountList();
        } catch (requestError: unknown) {
            setActionError(
                accountErrorMessage(
                    requestError,
                    'The account change could not be saved.',
                ),
            );
        } finally {
            setActionPending(false);
        }
    };

    const performPasswordReset = async () => {
        if (!selectedAccount) {
            return;
        }

        setActionPending(true);
        setActionError(null);
        setFeedback(null);
        setRevealedPassword(null);
        setCopyFeedback(null);

        try {
            const response = await requestJson<AccountMutationResponse>(
                '/operations/users/' + selectedAccount.id + '/reset-password',
                'POST',
            );
            setPendingAction(null);

            if (response.temporary_password) {
                setRevealedPassword({
                    name: selectedAccount.name,
                    value: response.temporary_password,
                });
            } else {
                setFeedback('The password was reset.');
            }

            setFeedback(
                'Password reset. The previous sessions and trusted devices were revoked.',
            );
            refreshAccountList();
        } catch (requestError: unknown) {
            setActionError(
                accountErrorMessage(
                    requestError,
                    'The password could not be reset.',
                ),
            );
        } finally {
            setActionPending(false);
        }
    };

    const handleCopyPassword = async () => {
        if (!revealedPassword) {
            return;
        }

        try {
            await navigator.clipboard.writeText(revealedPassword.value);
            setCopyFeedback('Temporary password copied.');
        } catch {
            setCopyFeedback(
                'Copy is unavailable in this browser. Select the password and copy it manually.',
            );
        }
    };

    const updateCreateField = (
        field: keyof CreateAccountForm,
        value: string,
    ) => {
        setCreateForm((current) => ({ ...current, [field]: value }));
        setCreateErrors((current) => ({ ...current, [field]: '' }));
    };

    const selectAccount = (account: AccountUser) => {
        setSelectedUserId(account.id);
        setShowMobileDetail(true);
        setRoleSelection(null);
        setPendingAction(null);
        setActionError(null);
        setFeedback(null);
        setRevealedPassword(null);
    };

    const renderAccountButton = (account: AccountUser, mobile = false) => {
        const isSelected = account.id === selectedAccount?.id;

        return (
            <button
                key={account.id}
                type="button"
                aria-pressed={isSelected}
                onClick={(event) => {
                    event.stopPropagation();
                    selectAccount(account);
                }}
                className={cn(
                    'w-full rounded-lg text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    isSelected
                        ? 'bg-brand-soft/60 text-ink'
                        : 'hover:bg-surface-subtle',
                    mobile ? 'p-3' : 'min-h-12 px-2 py-1',
                )}
            >
                <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                            {account.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-soft">
                            {account.username} · {account.email}
                        </span>
                    </span>
                    {mobile && <AccountStatus account={account} />}
                </span>
            </button>
        );
    };

    const from = result?.from ?? 0;
    const to = result?.to ?? 0;
    const total = result?.total ?? 0;
    const lastPage = result?.last_page ?? 1;
    const selfAccount = selectedAccount?.id === currentUserId;
    const isLastActiveAdmin = Boolean(
        selectedAccount &&
        currentRole === 'system_administrator' &&
        statusFor(selectedAccount) === 'Active' &&
        activeSystemAdministrators <= 1,
    );
    const suspensionProtectionMessage = selfAccount
        ? 'You cannot suspend your own account. Ask another System Administrator to manage your access.'
        : isLastActiveAdmin
          ? 'Keep at least one active System Administrator account so user access can still be managed.'
          : null;

    return (
        <>
            <div
                className={cn(
                    'grid items-start gap-4',
                    (selectedAccount || loading) &&
                        'min-[960px]:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,1fr)]',
                )}
                data-testid="account-management"
            >
                <Panel
                    className={cn(
                        'min-w-0 space-y-4 p-4 md:p-5',
                        showMobileDetail && 'hidden min-[960px]:block',
                    )}
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2
                                ref={directoryHeadingRef}
                                id="account-directory-heading"
                                tabIndex={-1}
                                className="text-base font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            >
                                Account directory
                            </h2>
                            <p className="mt-1 text-sm text-ink-soft">
                                Find and select a sign-in account.
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            className="hover:text-white"
                            onClick={(event) => {
                                setCreateFocusReturnTarget(event.currentTarget);
                                setCreateError(null);
                                setCreateErrors({});
                                setCreateForm(EMPTY_CREATE_FORM);
                                setShowCreate(true);
                            }}
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Create account
                        </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="relative sm:col-span-2">
                            <Search
                                className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-ink-soft"
                                aria-hidden="true"
                            />
                            <Input
                                aria-label="Search accounts"
                                autoComplete="off"
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                    setShowMobileDetail(false);
                                }}
                                placeholder="Name, username, or email"
                                className="pl-9"
                            />
                        </div>
                        <Select
                            aria-label="Filter accounts by role"
                            value={roleFilter}
                            onChange={(event) => {
                                setRoleFilter(event.target.value);
                                setPage(1);
                                setShowMobileDetail(false);
                            }}
                        >
                            <option value="">All roles</option>
                            {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                        <Select
                            aria-label="Filter accounts by status"
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setPage(1);
                                setShowMobileDetail(false);
                            }}
                        >
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                        </Select>
                    </div>

                    {error && (
                        <InlineNotice
                            tone="warning"
                            title="Accounts could not be loaded"
                            role="alert"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span>{error}</span>
                                <Button size="sm" onClick={refresh}>
                                    Retry
                                </Button>
                            </div>
                        </InlineNotice>
                    )}

                    {loading ? (
                        <div
                            className="space-y-3 py-2"
                            role="status"
                            aria-label="Loading accounts"
                            aria-busy="true"
                        >
                            <span className="sr-only">Loading accounts</span>
                            {[0, 1, 2].map((row) => (
                                <div
                                    key={row}
                                    aria-hidden="true"
                                    className="h-12 animate-pulse rounded-md bg-surface-subtle"
                                />
                            ))}
                        </div>
                    ) : total === 0 ? (
                        <div className="space-y-3">
                            <EmptyState
                                compact
                                icon={UserRound}
                                title={
                                    search || roleFilter || statusFilter
                                        ? 'No accounts match these filters'
                                        : 'No user accounts yet'
                                }
                                message={
                                    search || roleFilter || statusFilter
                                        ? 'Clear a search or filter to see more accounts.'
                                        : 'Create an account to give an employee sign-in access.'
                                }
                                announce
                            />
                            {(search || roleFilter || statusFilter) && (
                                <div className="flex justify-center">
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setSearch('');
                                            setRoleFilter('');
                                            setStatusFilter('');
                                            setPage(1);
                                            setShowMobileDetail(false);
                                        }}
                                    >
                                        Clear filters
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden xl:block">
                                <Table
                                    aria-label="User accounts"
                                    className="min-w-[37rem]"
                                    containerClassName="max-h-[min(56vh,36rem)] overflow-auto overscroll-contain"
                                >
                                    <TableHeader className="sticky top-0 z-10">
                                        <TableRow hoverable={false}>
                                            <TableHead>Account</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {accounts.map((account) => (
                                            <TableRow
                                                key={account.id}
                                                selected={
                                                    account.id ===
                                                    selectedAccount?.id
                                                }
                                                className="cursor-pointer"
                                                onClick={(event) => {
                                                    selectAccount(account);
                                                    event.currentTarget
                                                        .querySelector('button')
                                                        ?.focus();
                                                }}
                                            >
                                                <TableCell className="min-w-64">
                                                    {renderAccountButton(
                                                        account,
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {roleLabel(
                                                        roleFor(account),
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <AccountStatus
                                                        account={account}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div
                                className="max-h-[min(48vh,28rem)] divide-y divide-line overflow-y-auto overscroll-contain rounded-lg border border-line xl:hidden"
                                role="list"
                                aria-label="User accounts"
                            >
                                {accounts.map((account) => (
                                    <div
                                        key={account.id}
                                        role="listitem"
                                        className="p-1"
                                    >
                                        {renderAccountButton(account, true)}
                                        <p className="px-3 pb-2 text-xs text-ink-soft">
                                            {roleLabel(roleFor(account))}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div
                                className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between"
                                aria-live="polite"
                                aria-atomic="true"
                            >
                                <p className="text-xs text-ink-soft">
                                    Showing {from}–{to} of {total} accounts
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        aria-label="Previous accounts page"
                                        disabled={page <= 1 || loading}
                                        onClick={() =>
                                            setPage((current) =>
                                                Math.max(1, current - 1),
                                            )
                                        }
                                    >
                                        <ChevronLeft
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                        Previous
                                    </Button>
                                    <span className="min-w-20 text-center text-xs text-ink-soft">
                                        Page {result?.current_page ?? page} of{' '}
                                        {lastPage}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        aria-label="Next accounts page"
                                        disabled={page >= lastPage || loading}
                                        onClick={() =>
                                            setPage((current) =>
                                                Math.min(lastPage, current + 1),
                                            )
                                        }
                                    >
                                        Next
                                        <ChevronRight
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </Panel>

                {loading && !selectedAccount && (
                    <Panel
                        className="min-w-0 space-y-4 p-4 md:p-5"
                        aria-label="Loading account details"
                        aria-busy="true"
                    >
                        <span className="sr-only">Loading account details</span>
                        <div
                            aria-hidden="true"
                            className="h-7 w-2/3 animate-pulse rounded-md bg-surface-subtle"
                        />
                        <div className="space-y-2 border-t border-line pt-4">
                            <div
                                aria-hidden="true"
                                className="h-4 w-full animate-pulse rounded-md bg-surface-subtle"
                            />
                            <div
                                aria-hidden="true"
                                className="h-4 w-3/4 animate-pulse rounded-md bg-surface-subtle"
                            />
                        </div>
                    </Panel>
                )}

                {selectedAccount && (
                    <Panel
                        className={cn(
                            'min-w-0 space-y-4 p-4 min-[960px]:sticky min-[960px]:top-20 min-[960px]:max-h-[calc(100vh-6rem)] min-[960px]:overflow-y-auto md:p-5',
                            showMobileDetail
                                ? 'block'
                                : 'hidden min-[960px]:block',
                        )}
                    >
                        <Button
                            ref={detailBackButtonRef}
                            size="sm"
                            variant="secondary"
                            className="min-[960px]:hidden"
                            onClick={() => setShowMobileDetail(false)}
                        >
                            <ChevronLeft
                                className="h-4 w-4"
                                aria-hidden="true"
                            />
                            All accounts
                        </Button>
                        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold break-words text-ink">
                                    {selectedAccount.name}
                                </h2>
                                <dl className="mt-2 space-y-1 text-sm">
                                    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2">
                                        <dt className="text-ink-soft">
                                            Username
                                        </dt>
                                        <dd className="min-w-0 break-words text-ink">
                                            @{selectedAccount.username}
                                        </dd>
                                    </div>
                                    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2">
                                        <dt className="text-ink-soft">Email</dt>
                                        <dd className="min-w-0 break-words text-ink">
                                            {selectedAccount.email}
                                        </dd>
                                    </div>
                                    {selectedAccount.phone && (
                                        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2">
                                            <dt className="text-ink-soft">
                                                Phone
                                            </dt>
                                            <dd className="min-w-0 break-words text-ink">
                                                {selectedAccount.phone}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                            <div className="self-start">
                                <AccountStatus account={selectedAccount} />
                            </div>
                        </div>

                        {feedback && (
                            <div
                                className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-sm text-success-strong"
                                role="status"
                                aria-live="polite"
                            >
                                <Check
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>{feedback}</span>
                            </div>
                        )}

                        {revealedPassword && (
                            <InlineNotice
                                tone="info"
                                title={
                                    'Temporary password for ' +
                                    revealedPassword.name
                                }
                            >
                                <p>
                                    Copy this password now. It will disappear
                                    when you dismiss this message.
                                </p>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <code
                                        className="min-h-11 flex-1 overflow-x-auto rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink select-all"
                                        aria-label="Temporary password"
                                    >
                                        {revealedPassword.value}
                                    </code>
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            void handleCopyPassword()
                                        }
                                    >
                                        <Copy
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                        />
                                        Copy password
                                    </Button>
                                    <Button
                                        variant="quiet"
                                        onClick={() => {
                                            setRevealedPassword(null);
                                            setCopyFeedback(null);
                                        }}
                                    >
                                        Done
                                    </Button>
                                </div>
                                {copyFeedback && (
                                    <p
                                        className="mt-2 text-xs"
                                        role="status"
                                        aria-live="polite"
                                    >
                                        {copyFeedback}
                                    </p>
                                )}
                            </InlineNotice>
                        )}

                        <div className="grid gap-4 2xl:grid-cols-2">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck
                                        className="h-4 w-4 text-brand-strong"
                                        aria-hidden="true"
                                    />
                                    <h3 className="font-semibold text-ink">
                                        Access
                                    </h3>
                                </div>
                                <FormField
                                    label="Account role"
                                    description="A role change revokes existing sign-in sessions and trusted devices."
                                >
                                    <Select
                                        aria-label="Account role"
                                        value={selectedRole}
                                        onChange={(event) => {
                                            if (selectedAccount) {
                                                setRoleSelection({
                                                    userId: selectedAccount.id,
                                                    role: event.target.value,
                                                });
                                            }
                                        }}
                                        disabled={actionPending}
                                    >
                                        {!ROLE_OPTIONS.some(
                                            (option) =>
                                                option.value === selectedRole,
                                        ) &&
                                            selectedRole && (
                                                <option
                                                    value={selectedRole}
                                                    disabled
                                                >
                                                    Current role:{' '}
                                                    {roleLabel(selectedRole)}
                                                </option>
                                            )}
                                        {!selectedRole && (
                                            <option value="" disabled>
                                                Choose a role
                                            </option>
                                        )}
                                        {ROLE_OPTIONS.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </Select>
                                </FormField>
                                <Button
                                    variant="secondary"
                                    disabled={
                                        actionPending ||
                                        !selectedRole ||
                                        selectedRole === currentRole
                                    }
                                    onClick={() =>
                                        void performAccessUpdate(
                                            { role: selectedRole },
                                            'Account role updated.',
                                        )
                                    }
                                >
                                    Save role
                                </Button>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <KeyRound
                                        className="h-4 w-4 text-brand-strong"
                                        aria-hidden="true"
                                    />
                                    <h3 className="font-semibold text-ink">
                                        Sign-in controls
                                    </h3>
                                </div>
                                <p className="text-sm leading-5 text-ink-soft">
                                    Suspending or resetting a password revokes
                                    active sessions and trusted devices.
                                </p>
                                <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-y border-line py-2">
                                    <dt className="text-sm font-medium text-ink">
                                        Two-step sign-in
                                    </dt>
                                    <dd className="text-sm font-medium text-ink">
                                        {selectedAccount.email_otp_enabled
                                            ? 'Enabled'
                                            : 'Disabled'}
                                    </dd>
                                    <dd className="col-span-2 text-xs text-ink-soft">
                                        Email verification code
                                    </dd>
                                </dl>
                                {suspensionProtectionMessage && (
                                    <p
                                        id="account-suspension-protection"
                                        className="text-sm text-ink-soft"
                                    >
                                        {suspensionProtectionMessage}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {statusFor(selectedAccount) === 'Active' ? (
                                        <Button
                                            variant="danger"
                                            disabled={
                                                Boolean(
                                                    suspensionProtectionMessage,
                                                ) || actionPending
                                            }
                                            aria-describedby={
                                                suspensionProtectionMessage
                                                    ? 'account-suspension-protection'
                                                    : undefined
                                            }
                                            onClick={() => {
                                                setActionError(null);
                                                setPendingAction('suspend');
                                            }}
                                        >
                                            Suspend account
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="secondary"
                                            disabled={actionPending}
                                            onClick={() =>
                                                void performAccessUpdate(
                                                    { is_active: true },
                                                    'Account reactivated.',
                                                )
                                            }
                                        >
                                            Reactivate account
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        disabled={actionPending}
                                        onClick={() => {
                                            setActionError(null);
                                            setPendingAction('reset-password');
                                        }}
                                    >
                                        Reset password
                                    </Button>
                                </div>

                                {pendingAction === 'suspend' && (
                                    <InlineNotice
                                        tone="warning"
                                        title="Suspend this account?"
                                        role="alert"
                                    >
                                        <p>
                                            {selectedAccount.name} will lose
                                            sign-in access. Current sessions,
                                            trusted devices, and authentication
                                            codes will be revoked. You can
                                            reactivate the account later.
                                        </p>
                                        <div className="mt-3 flex gap-2">
                                            <Button
                                                variant="danger"
                                                disabled={actionPending}
                                                onClick={() =>
                                                    void performAccessUpdate(
                                                        { is_active: false },
                                                        'Account suspended and existing access revoked.',
                                                    )
                                                }
                                            >
                                                {actionPending
                                                    ? 'Suspending…'
                                                    : 'Confirm suspension'}
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                disabled={actionPending}
                                                onClick={() =>
                                                    setPendingAction(null)
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </InlineNotice>
                                )}

                                {pendingAction === 'reset-password' && (
                                    <InlineNotice
                                        tone="warning"
                                        title="Reset this password?"
                                        role="alert"
                                    >
                                        <p>
                                            Existing sessions and trusted
                                            devices will be revoked. The new
                                            temporary password will be shown
                                            once here.
                                        </p>
                                        <div className="mt-3 flex gap-2">
                                            <Button
                                                variant="danger"
                                                disabled={actionPending}
                                                onClick={() =>
                                                    void performPasswordReset()
                                                }
                                            >
                                                {actionPending
                                                    ? 'Resetting…'
                                                    : 'Confirm password reset'}
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                disabled={actionPending}
                                                onClick={() =>
                                                    setPendingAction(null)
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </InlineNotice>
                                )}

                                {actionError && (
                                    <InlineNotice
                                        tone="warning"
                                        title="Account change was not applied"
                                        role="alert"
                                    >
                                        {actionError}
                                    </InlineNotice>
                                )}
                            </div>
                        </div>
                        <SignInActivitySection
                            key={selectedAccount.id}
                            accountId={selectedAccount.id}
                            accountName={selectedAccount.name}
                            canViewAudit={canViewAudit}
                        />
                    </Panel>
                )}
            </div>

            <Modal
                open={showCreate}
                onClose={() => {
                    if (!createPending) {
                        setShowCreate(false);
                    }
                }}
                title="Create account"
                description="Create a sign-in account for an employee. A temporary password will be shown after creation; no email invitation is sent."
                size="lg"
                returnFocusTo={createFocusReturnTarget}
            >
                <form
                    id="create-account-form"
                    className="space-y-4"
                    onSubmit={(event) => void handleCreate(event)}
                >
                    {createError && (
                        <InlineNotice
                            tone="warning"
                            title="Account could not be created"
                            role="alert"
                        >
                            {createError}
                        </InlineNotice>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            label="Full name"
                            required
                            error={createErrors.name}
                        >
                            <Label
                                className="sr-only"
                                htmlFor="new-account-name"
                            >
                                Full name
                            </Label>
                            <Input
                                id="new-account-name"
                                value={createForm.name}
                                onChange={(event) =>
                                    updateCreateField(
                                        'name',
                                        event.target.value,
                                    )
                                }
                                autoComplete="name"
                                required
                                aria-invalid={Boolean(createErrors.name)}
                            />
                        </FormField>
                        <FormField
                            label="Username"
                            required
                            error={createErrors.username}
                        >
                            <Label
                                className="sr-only"
                                htmlFor="new-account-username"
                            >
                                Username
                            </Label>
                            <Input
                                id="new-account-username"
                                value={createForm.username}
                                onChange={(event) =>
                                    updateCreateField(
                                        'username',
                                        event.target.value,
                                    )
                                }
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                required
                                aria-invalid={Boolean(createErrors.username)}
                            />
                        </FormField>
                        <FormField
                            label="Email"
                            required
                            error={createErrors.email}
                        >
                            <Label
                                className="sr-only"
                                htmlFor="new-account-email"
                            >
                                Email
                            </Label>
                            <Input
                                id="new-account-email"
                                type="email"
                                value={createForm.email}
                                onChange={(event) =>
                                    updateCreateField(
                                        'email',
                                        event.target.value,
                                    )
                                }
                                autoComplete="email"
                                required
                                aria-invalid={Boolean(createErrors.email)}
                            />
                        </FormField>
                        <FormField
                            label="Phone"
                            description="Optional."
                            error={createErrors.phone}
                        >
                            <Label
                                className="sr-only"
                                htmlFor="new-account-phone"
                            >
                                Phone
                            </Label>
                            <Input
                                id="new-account-phone"
                                type="tel"
                                value={createForm.phone}
                                onChange={(event) =>
                                    updateCreateField(
                                        'phone',
                                        event.target.value,
                                    )
                                }
                                autoComplete="tel"
                                aria-invalid={Boolean(createErrors.phone)}
                            />
                        </FormField>
                        <FormField
                            label="Account role"
                            required
                            description="Choose System Administrator, Operations Manager, or Operator."
                            error={createErrors.role}
                            className="sm:col-span-2"
                        >
                            <Label
                                className="sr-only"
                                htmlFor="new-account-role"
                            >
                                Account role
                            </Label>
                            <Select
                                id="new-account-role"
                                value={createForm.role}
                                onChange={(event) =>
                                    updateCreateField(
                                        'role',
                                        event.target.value,
                                    )
                                }
                                required
                                aria-invalid={Boolean(createErrors.role)}
                            >
                                {ROLE_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </FormField>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-line pt-4">
                        <Button
                            variant="secondary"
                            disabled={createPending}
                            onClick={() => setShowCreate(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            className="hover:text-white"
                            type="submit"
                            form="create-account-form"
                            disabled={createPending}
                        >
                            {createPending
                                ? 'Creating account…'
                                : 'Create account'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

export function UserManagementWorkspaceSection({
    users,
    capabilities,
}: {
    users: WorkspaceUserViewModel[];
    capabilities: WorkspaceCapabilities;
}) {
    const [activeView, setActiveView] = useState<'accounts' | 'credentials'>(
        'accounts',
    );
    const canManage = capabilities.manage_users ?? false;
    const canViewAudit = capabilities.view_audit ?? false;
    const handleViewKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        let nextView: 'accounts' | 'credentials' | null = null;

        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            nextView = activeView === 'accounts' ? 'credentials' : 'accounts';
        } else if (event.key === 'Home') {
            nextView = 'accounts';
        } else if (event.key === 'End') {
            nextView = 'credentials';
        }

        if (nextView) {
            event.preventDefault();
            setActiveView(nextView);
            document.getElementById(`users-${nextView}-tab`)?.focus();
        }
    };

    return (
        <div>
            <PageHeading
                title={
                    activeView === 'accounts'
                        ? 'Account management'
                        : 'Personnel credentials'
                }
                description={
                    activeView === 'accounts'
                        ? 'Review sign-in roles and account status.'
                        : 'Review qualifications and employee credentials.'
                }
            />
            <div className="p-4 md:p-6">
                {!canManage ? (
                    <Panel>
                        <EmptyState
                            icon={ShieldCheck}
                            title="User management is unavailable"
                            message="Your account does not have permission to manage users."
                            announce
                        />
                    </Panel>
                ) : (
                    <>
                        <div
                            className="mb-4 flex flex-wrap gap-1 rounded-lg bg-surface-subtle p-1 sm:w-fit"
                            role="tablist"
                            aria-label="User administration views"
                        >
                            <Button
                                id="users-accounts-tab"
                                variant={
                                    activeView === 'accounts'
                                        ? 'secondary'
                                        : 'quiet'
                                }
                                role="tab"
                                aria-selected={activeView === 'accounts'}
                                aria-controls="users-accounts-panel"
                                tabIndex={activeView === 'accounts' ? 0 : -1}
                                onClick={() => setActiveView('accounts')}
                                onKeyDown={handleViewKeyDown}
                            >
                                <UserRound
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Accounts
                            </Button>
                            <Button
                                id="users-credentials-tab"
                                variant={
                                    activeView === 'credentials'
                                        ? 'secondary'
                                        : 'quiet'
                                }
                                role="tab"
                                aria-selected={activeView === 'credentials'}
                                aria-controls="users-credentials-panel"
                                tabIndex={activeView === 'credentials' ? 0 : -1}
                                onClick={() => setActiveView('credentials')}
                                onKeyDown={handleViewKeyDown}
                            >
                                <ShieldCheck
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Personnel credentials
                            </Button>
                        </div>
                        {activeView === 'accounts' ? (
                            <div
                                id="users-accounts-panel"
                                role="tabpanel"
                                aria-labelledby="users-accounts-tab"
                                tabIndex={0}
                            >
                                <AccountManagementSection
                                    canViewAudit={canViewAudit}
                                />
                            </div>
                        ) : (
                            <div
                                id="users-credentials-panel"
                                role="tabpanel"
                                aria-labelledby="users-credentials-tab"
                                tabIndex={0}
                            >
                                <PersonnelWorkspaceSection
                                    users={users}
                                    capabilities={capabilities}
                                    embedded
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
