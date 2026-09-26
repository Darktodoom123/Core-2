import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserManagementWorkspaceSection } from '@/components/workspace/personnel/user-management-workspace-section';
import type {
    WorkspaceCapabilities,
    WorkspaceUserViewModel,
} from '@/types/workspace';

const mockFetch = vi.fn();
const mockClipboardWrite = vi.fn();

const capabilities = {
    create_dispatch: false,
    create_client: false,
    create_service_request: false,
    convert_service_request: false,
    create_rental_dispatch: false,
    share_location: false,
    view_tracking: false,
    request_fuel: false,
    forward_fuel: false,
    approve_fuel: false,
    verify_fuel: false,
    record_fuel: false,
    decide_approval: false,
    update_assigned_dispatch_status: false,
    update_asset_status: false,
    safety_lockdown_asset: false,
    inspect_asset: false,
    maintain_asset: false,
    request_gpt_assistance: false,
    decide_gpt_recommendation: false,
    retry_gpt_recommendation: false,
    create_job_report: false,
    attachment_upload: false,
    attachment_policy: {
        owner_type: 'job_report',
        max_bytes: 1,
        max_count: 1,
        accepted_mime_types: [],
    },
    review_job_report: false,
    export_reports: false,
    manage_notifications: false,
    view_archive: false,
    restore_dispatch: false,
    view_sos: false,
    respond_sos: false,
    manage_users: true,
} satisfies WorkspaceCapabilities;

const workspaceUsers: WorkspaceUserViewModel[] = [
    {
        id: 1,
        name: 'Alex Admin',
        username: 'alex.admin',
        email: 'alex@example.test',
        phone: null,
        is_active: true,
        suspended_at: null,
        role: 'system_administrator',
        role_label: 'System Administrator',
        credentials: [],
    },
];

const account = {
    id: 1,
    name: 'Alex Admin',
    username: 'alex.admin',
    email: 'alex@example.test',
    phone: null,
    is_active: true,
    suspended_at: null,
    email_otp_enabled: true,
    roles: [{ id: 1, name: 'system_administrator' }],
};

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    };
}

function paginated(
    accounts: (typeof account)[],
    activeSystemAdministrators = 1,
) {
    return {
        data: {
            data: accounts,
            current_page: 1,
            last_page: 1,
            per_page: 50,
            total: accounts.length,
            from: accounts.length > 0 ? 1 : null,
            to: accounts.length > 0 ? accounts.length : null,
        },
        active_system_administrators: activeSystemAdministrators,
    };
}

function renderSection(overrides: Partial<WorkspaceCapabilities> = {}) {
    return render(
        <UserManagementWorkspaceSection
            users={workspaceUsers}
            capabilities={{ ...capabilities, ...overrides }}
        />,
    );
}

describe('UserManagementWorkspaceSection', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockClipboardWrite.mockReset();
        mockFetch.mockResolvedValue(jsonResponse(paginated([account])));
        vi.stubGlobal('fetch', mockFetch);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: mockClipboardWrite },
        });
        document.head.innerHTML =
            '<meta name="csrf-token" content="test-csrf-token">';
    });

    it('loads real accounts and provides a separate personnel-credentials view', async () => {
        renderSection();

        expect(
            await screen.findByRole('heading', { name: 'Alex Admin' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('table', { name: 'User accounts' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Showing 1–1 of 1 accounts'),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('tab', { name: /Personnel credentials/ }),
        );

        expect(
            screen.getByRole('heading', { name: 'Compliance Credentials' }),
        ).toBeInTheDocument();
        expect(mockFetch).toHaveBeenCalledWith(
            '/operations/users?page=1',
            expect.objectContaining({
                method: 'GET',
                credentials: 'same-origin',
            }),
        );
    });

    it('keeps existing Rigger accounts filterable without offering Rigger for assignment', async () => {
        const riggerAccount = {
            ...account,
            id: 2,
            name: 'Rigger Account',
            username: 'rigger.account',
            email: 'rigger@example.test',
            roles: [{ id: 4, name: 'rigger' }],
        };
        mockFetch.mockResolvedValue(
            jsonResponse(paginated([account, riggerAccount])),
        );

        renderSection();

        expect(
            await screen.findByRole('row', { name: /Rigger Account/ }),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getAllByRole('button', { name: /Rigger Account/ })[0],
        );
        expect(
            await screen.findByRole('option', {
                name: 'Current role: Rigger',
            }),
        ).toBeInTheDocument();

        const roleFilter = screen.getByRole('combobox', {
            name: 'Filter accounts by role',
        });
        expect(
            within(roleFilter).getByRole('option', { name: 'Rigger' }),
        ).toBeInTheDocument();

        fireEvent.change(roleFilter, { target: { value: 'rigger' } });
        await waitFor(() =>
            expect(mockFetch).toHaveBeenLastCalledWith(
                '/operations/users?role=rigger&page=1',
                expect.objectContaining({ method: 'GET' }),
            ),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
        const dialog = screen.getByRole('dialog');
        const assignmentRole = within(dialog).getByRole('combobox', {
            name: 'Account role',
        });
        expect(
            within(assignmentRole).queryByRole('option', { name: 'Rigger' }),
        ).not.toBeInTheDocument();
    });

    it('supports arrow-key navigation between Accounts and Personnel credentials tabs', async () => {
        renderSection();

        const accountsTab = await screen.findByRole('tab', {
            name: 'Accounts',
        });
        const credentialsTab = screen.getByRole('tab', {
            name: 'Personnel credentials',
        });

        expect(accountsTab).toHaveAttribute('aria-selected', 'true');
        expect(credentialsTab).toHaveAttribute('aria-selected', 'false');

        fireEvent.keyDown(accountsTab, { key: 'ArrowRight' });

        expect(credentialsTab).toHaveAttribute('aria-selected', 'true');
        expect(
            screen.getByRole('tabpanel', {
                name: 'Personnel credentials',
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Compliance Credentials' }),
        ).toBeInTheDocument();
    });

    it('announces loading and empty results, with a clear-filters action', async () => {
        let requestStarted = false;
        let firstRequest = true;
        const deferred: {
            resolve?: (response: ReturnType<typeof jsonResponse>) => void;
        } = {};
        mockFetch.mockImplementation(() => {
            if (!firstRequest) {
                return Promise.resolve(jsonResponse(paginated([])));
            }

            firstRequest = false;

            return new Promise((resolve) => {
                requestStarted = true;
                deferred.resolve = resolve;
            });
        });

        renderSection();

        expect(
            screen.getByRole('status', { name: 'Loading accounts' }),
        ).toHaveAttribute('aria-busy', 'true');
        await waitFor(() => expect(requestStarted).toBe(true));
        deferred.resolve?.(jsonResponse(paginated([])));

        expect(
            await screen.findByText('No user accounts yet'),
        ).toBeInTheDocument();
        fireEvent.change(
            screen.getByRole('combobox', { name: 'Filter accounts by status' }),
            {
                target: { value: 'active' },
            },
        );

        expect(
            await screen.findByText('No accounts match these filters'),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(
            await screen.findByText('No user accounts yet'),
        ).toBeInTheDocument();
    });

    it('keeps administrator roles assignable when other accounts already hold them', async () => {
        const manager = {
            ...account,
            id: 2,
            name: 'Taylor Manager',
            username: 'taylor.manager',
            email: 'taylor@example.test',
            roles: [{ id: 2, name: 'operations_manager' }],
        };
        const secondManager = {
            ...manager,
            id: 3,
            name: 'Morgan Manager',
            username: 'morgan.manager',
            email: 'morgan@example.test',
        };
        mockFetch.mockResolvedValue(
            jsonResponse(paginated([account, manager, secondManager])),
        );

        renderSection();

        await screen.findByRole('heading', { name: 'Alex Admin' });
        expect(
            screen.queryByText('Single-person role assignments need review'),
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
        const dialog = screen.getByRole('dialog');
        expect(
            within(dialog).getByRole('option', {
                name: 'System Administrator',
            }),
        ).toBeEnabled();
        expect(
            within(dialog).getByRole('option', {
                name: 'Operations Manager',
            }),
        ).toBeEnabled();
        expect(
            within(dialog).getByRole('combobox', { name: 'Account role' }),
        ).toHaveValue('operations_manager');
    });

    it('selects a desktop account when a non-name cell is clicked', async () => {
        const manager = {
            ...account,
            id: 2,
            name: 'Taylor Manager',
            username: 'taylor.manager',
            email: 'taylor@example.test',
            roles: [{ id: 2, name: 'operations_manager' }],
        };
        mockFetch.mockResolvedValue(
            jsonResponse(paginated([account, manager])),
        );

        renderSection();

        const managerRow = await screen.findByRole('row', {
            name: /Taylor Manager/,
        });
        fireEvent.click(within(managerRow).getByText('Operations Manager'));

        expect(
            await screen.findByRole('heading', { name: 'Taylor Manager' }),
        ).toBeInTheDocument();
        expect(within(managerRow).getByRole('button')).toHaveFocus();
    });

    it('does not apply a last-account suspension rule to Operations Managers', async () => {
        const manager = {
            ...account,
            id: 2,
            roles: [{ id: 2, name: 'operations_manager' }],
            name: 'Taylor Manager',
            username: 'taylor.manager',
            email: 'taylor@example.test',
        };
        mockFetch.mockResolvedValue(
            jsonResponse(paginated([account, manager])),
        );

        renderSection();

        await screen.findByRole('heading', { name: 'Alex Admin' });
        fireEvent.click(
            screen.getAllByRole('button', { name: /Taylor Manager/ })[0],
        );
        expect(
            screen.queryByText(/Keep at least one active Operations Manager/),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Suspend account' }),
        ).toBeEnabled();
    });

    it('creates an account with a temporary password and offers one-time copy', async () => {
        const createdAccount = {
            ...account,
            id: 22,
            name: 'New Operator',
            username: 'new.operator',
            email: 'new.operator@example.test',
            roles: [{ id: 2, name: 'crane_operator' }],
        };
        let created = false;
        mockFetch.mockImplementation(
            async (url: string, init?: RequestInit) => {
                if (init?.method === 'POST' && url === '/operations/users') {
                    created = true;

                    return jsonResponse(
                        {
                            data: createdAccount,
                            temporary_password: 'Only-once-Password-24!',
                        },
                        201,
                    );
                }

                if (
                    typeof url === 'string' &&
                    url.startsWith('/operations/users?')
                ) {
                    return jsonResponse(
                        paginated([created ? createdAccount : account]),
                    );
                }

                return jsonResponse(paginated([account]));
            },
        );

        renderSection();
        await screen.findByRole('heading', { name: 'Alex Admin' });
        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

        const dialog = screen.getByRole('dialog');
        expect(
            within(dialog).getByText(/no email invitation is sent/i),
        ).toBeInTheDocument();
        expect(
            within(dialog).queryByRole('option', { name: /Rigger/i }),
        ).not.toBeInTheDocument();
        fireEvent.change(
            within(dialog).getByRole('textbox', { name: 'Full name' }),
            { target: { value: 'New Operator' } },
        );
        fireEvent.change(
            within(dialog).getByRole('textbox', { name: 'Username' }),
            { target: { value: 'new.operator' } },
        );
        fireEvent.change(
            within(dialog).getByRole('textbox', { name: 'Email' }),
            { target: { value: 'new.operator@example.test' } },
        );

        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Create account' }),
        );

        expect(
            await screen.findByText('Only-once-Password-24!'),
        ).toBeInTheDocument();
        const createCall = mockFetch.mock.calls.find(
            ([url, init]) =>
                url === '/operations/users' && init?.method === 'POST',
        );
        expect(createCall).toBeDefined();
        expect(new Headers(createCall?.[1]?.headers).get('X-CSRF-TOKEN')).toBe(
            'test-csrf-token',
        );
        expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
            role: 'operations_manager',
            generate_temp_password: true,
        });

        mockClipboardWrite.mockResolvedValue(undefined);
        fireEvent.click(screen.getByRole('button', { name: 'Copy password' }));
        await waitFor(() =>
            expect(mockClipboardWrite).toHaveBeenCalledWith(
                'Only-once-Password-24!',
            ),
        );
        expect(
            await screen.findByText('Temporary password copied.'),
        ).toBeInTheDocument();
    });

    it('shows server field errors without discarding the create form', async () => {
        mockFetch.mockImplementation(
            async (url: string, init?: RequestInit) => {
                if (init?.method === 'POST' && url === '/operations/users') {
                    return jsonResponse(
                        {
                            message: 'The given data was invalid.',
                            errors: {
                                username: ['That username is already in use.'],
                            },
                        },
                        422,
                    );
                }

                return jsonResponse(paginated([account]));
            },
        );

        renderSection();
        await screen.findByRole('heading', { name: 'Alex Admin' });
        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.change(
            within(dialog).getByRole('textbox', { name: 'Full name' }),
            { target: { value: 'Sam Operator' } },
        );
        fireEvent.change(
            within(dialog).getByRole('textbox', { name: 'Username' }),
            { target: { value: 'existing.name' } },
        );
        fireEvent.change(
            within(dialog).getByRole('textbox', { name: 'Email' }),
            { target: { value: 'sam@example.test' } },
        );
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Create account' }),
        );

        expect(
            await within(dialog).findByText('That username is already in use.'),
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole('textbox', { name: 'Full name' }),
        ).toHaveValue('Sam Operator');
    });

    it('announces the last-administrator guard when a role change is rejected', async () => {
        const protectionMessage =
            'The last active System Administrator cannot be suspended or demoted.';
        mockFetch.mockImplementation(
            async (url: string, init?: RequestInit) => {
                if (url === '/operations/users/1' && init?.method === 'PATCH') {
                    return jsonResponse(
                        {
                            message: 'The given data was invalid.',
                            errors: { user: [protectionMessage] },
                        },
                        422,
                    );
                }

                return jsonResponse(paginated([account]));
            },
        );

        renderSection();
        await screen.findByRole('heading', { name: 'Alex Admin' });
        fireEvent.change(
            screen.getByRole('combobox', { name: 'Account role' }),
            {
                target: { value: 'operations_manager' },
            },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save role' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            protectionMessage,
        );
        expect(mockFetch).toHaveBeenCalledWith(
            '/operations/users/1',
            expect.objectContaining({ method: 'PATCH' }),
        );
    });

    it('confirms suspension and password reset before applying access changes', async () => {
        mockFetch.mockImplementation(
            async (url: string, init?: RequestInit) => {
                if (
                    init?.method === 'POST' &&
                    url === '/operations/users/1/reset-password'
                ) {
                    return jsonResponse({
                        message: 'Temporary password generated successfully.',
                        temporary_password: 'Reset-once-Password-31!',
                    });
                }

                if (init?.method === 'PATCH' && url === '/operations/users/1') {
                    const body = JSON.parse(init.body as string);

                    return jsonResponse({
                        data: {
                            ...account,
                            is_active: body.is_active ?? account.is_active,
                            suspended_at:
                                body.is_active === false
                                    ? '2026-09-25T00:00:00.000Z'
                                    : null,
                        },
                    });
                }

                return jsonResponse(paginated([account], 2));
            },
        );

        renderSection();
        await screen.findByRole('heading', { name: 'Alex Admin' });

        fireEvent.click(
            screen.getByRole('button', { name: 'Suspend account' }),
        );
        expect(screen.getByText('Suspend this account?')).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm suspension' }),
        );
        await waitFor(() =>
            expect(mockFetch).toHaveBeenCalledWith(
                '/operations/users/1',
                expect.objectContaining({ method: 'PATCH' }),
            ),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
        expect(screen.getByText('Reset this password?')).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm password reset' }),
        );
        expect(
            await screen.findByText('Reset-once-Password-31!'),
        ).toBeInTheDocument();
        expect(mockFetch).toHaveBeenCalledWith(
            '/operations/users/1/reset-password',
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('shows email-code two-step status and paginated sign-in activity to audit viewers', async () => {
        const activity = (page: number) => ({
            data: [
                {
                    id: page,
                    event_label: page === 1 ? 'Signed in' : 'Signed out',
                    device_label: 'Chrome on Windows',
                    device_type: 'desktop',
                    location: 'Quezon City, Philippines',
                    ip_address: '192.0.2.10',
                    occurred_at: '2026-09-25T08:00:00Z',
                    occurred_at_human:
                        page === 1 ? '2 minutes ago' : '1 hour ago',
                },
            ],
            current_page: page,
            last_page: 2,
            per_page: 10,
            total: 11,
        });
        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes('/sign-in-activity')) {
                const page = url.includes('page=2') ? 2 : 1;

                return jsonResponse(activity(page));
            }

            return jsonResponse(paginated([account]));
        });

        renderSection({ view_audit: true });

        expect(
            await screen.findByRole('heading', { name: 'Alex Admin' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Two-step sign-in')).toBeInTheDocument();
        expect(screen.getByText('Email verification code')).toBeInTheDocument();
        expect(screen.getByText('Enabled')).toBeInTheDocument();
        expect(await screen.findByText('Signed in')).toBeInTheDocument();
        expect(screen.getByText(/Chrome on Windows/)).toBeInTheDocument();
        expect(screen.getByText(/Device:/)).toBeInTheDocument();
        expect(
            screen.getByText('Location:', { exact: true }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Quezon City, Philippines', { exact: false }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Location is approximate from the sign-in IP/),
        ).toBeInTheDocument();
        expect(screen.getByText(/IP: 192\.0\.2\.10/)).toBeInTheDocument();
        expect(mockFetch).toHaveBeenCalledWith(
            '/operations/users/1/sign-in-activity?page=1&per_page=10',
            expect.objectContaining({ method: 'GET' }),
        );

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Next sign-in activity page',
            }),
        );
        expect(await screen.findByText('Signed out')).toBeInTheDocument();
        await waitFor(() =>
            expect(mockFetch).toHaveBeenCalledWith(
                '/operations/users/1/sign-in-activity?page=2&per_page=10',
                expect.objectContaining({ method: 'GET' }),
            ),
        );
    });

    it('keeps sign-in history view-only and reports failures with a retry path', async () => {
        const { unmount: unmountWithoutAudit } = renderSection();

        expect(
            await screen.findByText(
                'Audit permission is required to view account sign-in activity.',
            ),
        ).toBeInTheDocument();
        expect(
            mockFetch.mock.calls.some(([url]) =>
                String(url).includes('/sign-in-activity'),
            ),
        ).toBe(false);
        unmountWithoutAudit();

        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes('/sign-in-activity')) {
                return jsonResponse(
                    { message: 'Audit service unavailable.' },
                    503,
                );
            }

            return jsonResponse(paginated([account]));
        });

        const { unmount } = renderSection({ view_audit: true });
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Audit service unavailable.',
        );

        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes('/sign-in-activity')) {
                return jsonResponse({
                    data: [],
                    current_page: 1,
                    last_page: 1,
                    per_page: 10,
                    total: 0,
                });
            }

            return jsonResponse(paginated([account]));
        });
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(
            await screen.findByText('No sign-in activity has been recorded.'),
        ).toBeInTheDocument();
        unmount();
    });

    it('shows when email-code two-step sign-in is disabled', async () => {
        const accountWithoutOtp = { ...account, email_otp_enabled: false };
        mockFetch.mockResolvedValue(
            jsonResponse(paginated([accountWithoutOtp])),
        );

        renderSection();

        expect(await screen.findByText('Disabled')).toBeInTheDocument();
    });

    it('does not expose account controls without the user-management capability', () => {
        renderSection({ manage_users: false });

        expect(
            screen.getByText('User management is unavailable'),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Create account' }),
        ).not.toBeInTheDocument();
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
