import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountSettings from '@/pages/account';

const mockProps = {
    profile: {
        name: 'Jane Doe',
        username: 'jane.doe',
        email: 'jane@example.com',
        email_verified: true,
        phone: '+1 555-0199',
        role: 'operations_manager',
        role_label: 'Operations Manager',
        account_status: 'active' as const,
        account_status_label: 'Active',
        permissions: ['dispatch.manage', 'fleet.view_all'],
    },
    security: {
        email_otp_enabled: false,
        has_verified_email: true,
    },
    sessions: [],
    recent_activity: {
        data: [],
        links: [],
        current_page: 1,
        last_page: 1,
        prev_page_url: null,
        next_page_url: null,
        per_page: 15,
        total: 0,
        from: null,
        to: null,
    },
};

let customPasswordFormState: {
    processing?: boolean;
    recentlySuccessful?: boolean;
    isDirty?: boolean;
    errors?: Record<string, string>;
} = {};

const mockPost = vi.fn();
const mockReset = vi.fn();

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: {
            auth: {
                user: { id: 1, name: 'Jane Doe', email: 'jane@example.com' },
            },
            flash: {},
            errors: {},
        },
    }),
    Link: ({ children, href, ...props }: any) =>
        React.createElement('a', { href, ...props }, children),
    router: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        reload: vi.fn(),
    },
    Head: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    useForm: (initialValues: any = {}) => {
        const [data, setDataState] = useState(initialValues);

        const isPasswordForm =
            initialValues &&
            typeof initialValues === 'object' &&
            'password_confirmation' in initialValues;

        if (isPasswordForm) {
            return {
                data,
                setData: (keyOrFn: any, val?: any) => {
                    if (typeof keyOrFn === 'function') {
                        setDataState(keyOrFn);
                    } else if (typeof keyOrFn === 'string') {
                        setDataState((prev: any) => ({
                            ...prev,
                            [keyOrFn]: val,
                        }));
                    } else {
                        setDataState(keyOrFn);
                    }
                },
                errors: customPasswordFormState.errors ?? {},
                setError: vi.fn(),
                clearErrors: vi.fn(),
                reset: mockReset,
                defaults: vi.fn(),
                isDirty: customPasswordFormState.isDirty ?? false,
                processing: customPasswordFormState.processing ?? false,
                recentlySuccessful:
                    customPasswordFormState.recentlySuccessful ?? false,
                post: mockPost,
                patch: vi.fn(),
                put: vi.fn(),
                delete: vi.fn(),
                get: vi.fn(),
            };
        }

        return {
            data,
            setData: (keyOrFn: any, val?: any) => {
                if (typeof keyOrFn === 'function') {
                    setDataState(keyOrFn);
                } else if (typeof keyOrFn === 'string') {
                    setDataState((prev: any) => ({ ...prev, [keyOrFn]: val }));
                } else {
                    setDataState(keyOrFn);
                }
            },
            errors: {},
            setError: vi.fn(),
            clearErrors: vi.fn(),
            reset: vi.fn(),
            defaults: vi.fn(),
            isDirty: false,
            processing: false,
            recentlySuccessful: false,
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            get: vi.fn(),
        };
    },
}));

describe('AccountSettings Change Password Form', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        customPasswordFormState = {};
    });

    it('renders with accessible names, autocomplete attributes, and labels', () => {
        render(<AccountSettings {...mockProps} current_tab="security" />);

        expect(
            screen.getByRole('heading', { name: 'Change Password' }),
        ).toBeInTheDocument();

        const currentInput = screen.getByLabelText(/^Current Password/i);
        const newInput = screen.getByLabelText(/^New Password/i);
        const confirmInput = screen.getByLabelText(/^Confirm New Password/i);

        expect(currentInput).toHaveAttribute('name', 'current_password');
        expect(currentInput).toHaveAttribute(
            'autoComplete',
            'current-password',
        );
        expect(newInput).toHaveAttribute('name', 'password');
        expect(newInput).toHaveAttribute('autoComplete', 'new-password');
        expect(confirmInput).toHaveAttribute('name', 'password_confirmation');
        expect(confirmInput).toHaveAttribute('autoComplete', 'new-password');

        const submitBtn = screen.getByRole('button', {
            name: 'Update password',
        });
        expect(submitBtn).toBeInTheDocument();
        expect(submitBtn).not.toBeDisabled();
    });

    it('submits form data to /account/password with entered credentials', () => {
        render(<AccountSettings {...mockProps} current_tab="security" />);

        const currentInput = screen.getByLabelText(/^Current Password/i);
        const newInput = screen.getByLabelText(/^New Password/i);
        const confirmInput = screen.getByLabelText(/^Confirm New Password/i);
        const submitBtn = screen.getByRole('button', {
            name: 'Update password',
        });

        fireEvent.change(currentInput, {
            target: { value: 'CurrentSecret123!' },
        });
        fireEvent.change(newInput, {
            target: { value: 'BrandNewSecret123!' },
        });
        fireEvent.change(confirmInput, {
            target: { value: 'BrandNewSecret123!' },
        });

        fireEvent.click(submitBtn);

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith(
            '/account/password',
            expect.objectContaining({
                preserveScroll: true,
                onSuccess: expect.any(Function),
                onError: expect.any(Function),
            }),
        );
    });

    it('disables inputs, toggles, and button with spinner when processing is true', () => {
        customPasswordFormState.processing = true;

        render(<AccountSettings {...mockProps} current_tab="security" />);

        const currentInput = screen.getByLabelText(/^Current Password/i);
        const newInput = screen.getByLabelText(/^New Password/i);
        const confirmInput = screen.getByLabelText(/^Confirm New Password/i);

        expect(currentInput).toBeDisabled();
        expect(newInput).toBeDisabled();
        expect(confirmInput).toBeDisabled();

        const currentToggle = screen.getByLabelText('Show current password');
        const newToggle = screen.getByLabelText('Show new password');
        const confirmToggle = screen.getByLabelText(
            'Show password confirmation',
        );

        expect(currentToggle).toBeDisabled();
        expect(newToggle).toBeDisabled();
        expect(confirmToggle).toBeDisabled();

        const submitBtn = screen.getByRole('button', {
            name: /Updating password…/i,
        });
        expect(submitBtn).toBeDisabled();
    });

    it('blocks repeated submissions when processing is true', () => {
        customPasswordFormState.processing = true;

        render(<AccountSettings {...mockProps} current_tab="security" />);

        const form = screen
            .getByRole('heading', { name: 'Change Password' })
            .closest('div')
            ?.parentElement?.querySelector('form');

        expect(form).not.toBeNull();

        if (form) {
            fireEvent.submit(form);
        }

        expect(mockPost).not.toHaveBeenCalled();
    });

    it('displays validation errors under appropriate fields with alert role', () => {
        customPasswordFormState.errors = {
            current_password: 'The provided password does not match.',
            password: 'The password field confirmation does not match.',
            password_confirmation: 'Confirmation error details.',
        };

        render(<AccountSettings {...mockProps} current_tab="security" />);

        const alerts = screen.getAllByRole('alert');
        const alertTexts = alerts.map((a) => a.textContent);

        expect(alertTexts).toContain('The provided password does not match.');
        expect(alertTexts).toContain(
            'The password field confirmation does not match.',
        );
        expect(alertTexts).toContain('Confirmation error details.');
    });

    it('displays inline success indicator when recentlySuccessful is true and not dirty', () => {
        customPasswordFormState.recentlySuccessful = true;
        customPasswordFormState.isDirty = false;

        render(<AccountSettings {...mockProps} current_tab="security" />);

        const statusIndicator = screen.getByRole('status');
        expect(statusIndicator).toHaveTextContent('Password updated');
    });

    it('hides inline success indicator when form becomes dirty', () => {
        customPasswordFormState.recentlySuccessful = true;
        customPasswordFormState.isDirty = true;

        render(<AccountSettings {...mockProps} current_tab="security" />);

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('tests onError callback behavior: resets all fields on current_password failure, but preserves current_password on new password failure', () => {
        render(<AccountSettings {...mockProps} current_tab="security" />);

        const submitBtn = screen.getByRole('button', {
            name: 'Update password',
        });
        fireEvent.click(submitBtn);

        expect(mockPost).toHaveBeenCalled();
        const callArgs = mockPost.mock.calls[0][1];
        const onError = callArgs.onError;

        // Case A: error includes current_password -> resets all 3 fields
        onError({ current_password: 'Wrong password' });
        expect(mockReset).toHaveBeenCalledWith(
            'current_password',
            'password',
            'password_confirmation',
        );

        mockReset.mockClear();

        // Case B: error does not include current_password -> only resets password & confirmation
        onError({ password: 'Password too short' });
        expect(mockReset).toHaveBeenCalledWith(
            'password',
            'password_confirmation',
        );
    });
});
