import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import AccountSettings, { LocationBadge } from '@/pages/account';

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
    sessions: [
        {
            id: 'sess-1',
            is_current: true,
            ip_address: '127.0.0.1',
            browser: 'Chrome',
            platform: 'Windows',
            device_type: 'desktop' as const,
            device_label: 'Chrome on Windows',
            location: 'Local Machine (Loopback)',
            last_active_at: new Date().toISOString(),
            last_active_human: 'Active now',
        },
        {
            id: 'sess-2',
            is_current: false,
            ip_address: '10.0.0.50',
            browser: 'Safari',
            platform: 'iOS',
            device_type: 'mobile' as const,
            device_label: 'Safari on iOS',
            location: 'Local Network / Private IP',
            last_active_at: new Date(Date.now() - 3600000).toISOString(),
            last_active_human: '1 hour ago',
        },
        {
            id: 'sess-3',
            is_current: false,
            ip_address: '8.8.8.8',
            browser: 'Firefox',
            platform: 'Linux',
            device_type: 'desktop' as const,
            device_label: 'Firefox on Linux',
            location: 'Mountain View, United States',
            last_active_at: new Date(Date.now() - 7200000).toISOString(),
            last_active_human: '2 hours ago',
        },
    ],
    recent_activity: {
        data: [
            {
                id: 1,
                action: 'user.login',
                event_label: 'Signed in',
                outcome: 'success',
                ip_address: '127.0.0.1',
                device_label: 'Chrome on Windows',
                location: 'Local Machine (Loopback)',
                occurred_at: new Date().toISOString(),
                occurred_at_human: 'Just now',
            },
            {
                id: 2,
                action: 'user.password_changed',
                event_label: 'Password changed',
                outcome: 'success',
                ip_address: '8.8.8.8',
                device_label: 'Firefox on Linux',
                location: 'Mountain View, United States',
                occurred_at: new Date(Date.now() - 60000).toISOString(),
                occurred_at_human: '1 minute ago',
            },
        ],
        current_page: 1,
        last_page: 1,
        prev_page_url: null,
        next_page_url: null,
        links: [],
        total: 2,
    },
    current_tab: 'profile' as const,
};

describe('AccountSettings Page Component', () => {
    it('renders profile tab with user identity and managed account advisory', () => {
        render(<AccountSettings {...mockProps} />);

        expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(
            1,
        );
        expect(screen.getByText('@jane.doe')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
        expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Managed account:')).toBeInTheDocument();
        expect(screen.queryByText('dispatch.manage')).not.toBeInTheDocument();
        expect(
            screen.queryByText('Operations Manager'),
        ).not.toBeInTheDocument();
    });

    it('does not render roles, role badges, or assigned permissions cards anywhere on the page', () => {
        render(<AccountSettings {...mockProps} />);

        // Should not render role label anywhere
        expect(
            screen.queryByText('Operations Manager'),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('operations_manager'),
        ).not.toBeInTheDocument();

        // Should not render permissions or role sections
        expect(screen.queryByText('dispatch.manage')).not.toBeInTheDocument();
        expect(screen.queryByText('fleet.view_all')).not.toBeInTheDocument();
        expect(screen.queryByText(/Role Permissions/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Role governed/i)).not.toBeInTheDocument();
    });

    it('switches between Profile, Security, and Sign-in Activity tabs', () => {
        render(<AccountSettings {...mockProps} />);

        // Click Security tab
        fireEvent.click(screen.getByRole('tab', { name: /Security/i }));
        expect(
            screen.getByText('Two-Factor Authentication (2FA)'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Enable 2FA/i }),
        ).toBeInTheDocument();
        expect(screen.getByText('Change Password')).toBeInTheDocument();

        // Click Activity tab
        fireEvent.click(screen.getByRole('tab', { name: /Sign-in Activity/i }));
        expect(screen.getByText('Where you’re signed in')).toBeInTheDocument();
        expect(screen.getByText('This device')).toBeInTheDocument();
        expect(screen.getByText('Safari on iOS')).toBeInTheDocument();
        expect(screen.getByText('Recent activity')).toBeInTheDocument();
    });

    it('displays approximate geographic locations and local network labels instead of plain text Unavailable', () => {
        render(<AccountSettings {...mockProps} current_tab="activity" />);

        // Loopback location badge
        expect(
            screen.getAllByText('Local Machine (Loopback)').length,
        ).toBeGreaterThanOrEqual(1);

        // Private network location badge
        expect(
            screen.getByText('Local Network / Private IP'),
        ).toBeInTheDocument();

        // Approximate geographic location
        expect(
            screen.getAllByText('Mountain View, United States').length,
        ).toBeGreaterThanOrEqual(1);
    });

    it('supports tab navigation via keyboard arrow, Home, and End keys', () => {
        render(<AccountSettings {...mockProps} />);

        const profileTab = screen.getByRole('tab', { name: /Profile/i });
        fireEvent.keyDown(profileTab, { key: 'ArrowRight' });

        // Should now show Security panel
        expect(
            screen.getByText('Two-Factor Authentication (2FA)'),
        ).toBeInTheDocument();

        // Test End key moves to Sign-in Activity
        fireEvent.keyDown(screen.getByRole('tab', { name: /Security/i }), {
            key: 'End',
        });
        expect(screen.getByText('Where you’re signed in')).toBeInTheDocument();

        // Test Home key moves back to Profile
        fireEvent.keyDown(
            screen.getByRole('tab', { name: /Sign-in Activity/i }),
            { key: 'Home' },
        );
        // Test vertical ArrowDown navigation (APG vertical tabs standard)
        fireEvent.keyDown(screen.getByRole('tab', { name: /Profile/i }), {
            key: 'ArrowDown',
        });
        expect(
            screen.getByText('Two-Factor Authentication (2FA)'),
        ).toBeInTheDocument();

        // Test vertical ArrowUp navigation
        fireEvent.keyDown(screen.getByRole('tab', { name: /Security/i }), {
            key: 'ArrowUp',
        });
        expect(screen.getByText('Managed account:')).toBeInTheDocument();

        // Verify roving tabindex
        expect(screen.getByRole('tab', { name: /Profile/i })).toHaveAttribute(
            'tabindex',
            '0',
        );
        expect(screen.getByRole('tab', { name: /Security/i })).toHaveAttribute(
            'tabindex',
            '-1',
        );
    });

    it('opens confirmation modal when clicking revoke on an active session', async () => {
        render(<AccountSettings {...mockProps} current_tab="activity" />);

        const revokeButtons = screen.getAllByRole('button', {
            name: /Revoke/i,
        });
        expect(revokeButtons.length).toBeGreaterThanOrEqual(1);

        // Click revoke on the first other session (Safari on iOS)
        fireEvent.click(revokeButtons[0]);

        // Confirmation modal should be visible with device context
        expect(
            screen.getByRole('heading', { name: /Revoke Session/i }),
        ).toBeInTheDocument();
        expect(
            screen.getAllByText('Safari on iOS').length,
        ).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('10.0.0.50').length).toBeGreaterThanOrEqual(
            2,
        );
        expect(
            screen.getByRole('button', { name: /Revoke session/i }),
        ).toBeInTheDocument();

        // Click Cancel to dismiss modal
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        await waitFor(() => {
            expect(
                screen.queryByRole('heading', { name: /Revoke Session/i }),
            ).not.toBeInTheDocument();
        });
    });

    it('renders change password card with accessible inputs and toggles visibility for all fields', () => {
        render(<AccountSettings {...mockProps} current_tab="security" />);

        expect(
            screen.getByRole('heading', { name: 'Change Password' }),
        ).toBeInTheDocument();

        const currentPasswordInput =
            screen.getByLabelText(/^Current Password/i);
        const newPasswordInput = screen.getByLabelText(/^New Password/i);
        const confirmPasswordInput = screen.getByLabelText(
            /^Confirm New Password/i,
        );

        expect(currentPasswordInput).toHaveAttribute('type', 'password');
        expect(currentPasswordInput).toHaveAttribute(
            'name',
            'current_password',
        );
        expect(newPasswordInput).toHaveAttribute('type', 'password');
        expect(newPasswordInput).toHaveAttribute('name', 'password');
        expect(confirmPasswordInput).toHaveAttribute('type', 'password');
        expect(confirmPasswordInput).toHaveAttribute(
            'name',
            'password_confirmation',
        );

        // Toggle Current Password visibility
        const toggleCurrentBtn = screen.getByLabelText('Show current password');
        fireEvent.click(toggleCurrentBtn);
        expect(currentPasswordInput).toHaveAttribute('type', 'text');
        const hideCurrentBtn = screen.getByLabelText('Hide current password');
        fireEvent.click(hideCurrentBtn);
        expect(currentPasswordInput).toHaveAttribute('type', 'password');

        // Toggle New Password visibility
        const toggleNewBtn = screen.getByLabelText('Show new password');
        fireEvent.click(toggleNewBtn);
        expect(newPasswordInput).toHaveAttribute('type', 'text');
        const hideNewBtn = screen.getByLabelText('Hide new password');
        fireEvent.click(hideNewBtn);
        expect(newPasswordInput).toHaveAttribute('type', 'password');

        // Toggle Confirm Password visibility
        const toggleConfirmBtn = screen.getByLabelText(
            'Show password confirmation',
        );
        fireEvent.click(toggleConfirmBtn);
        expect(confirmPasswordInput).toHaveAttribute('type', 'text');
        const hideConfirmBtn = screen.getByLabelText(
            'Hide password confirmation',
        );
        fireEvent.click(hideConfirmBtn);
        expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    it('handles submitting the change password form', () => {
        render(<AccountSettings {...mockProps} current_tab="security" />);

        const currentPasswordInput =
            screen.getByLabelText(/^Current Password/i);
        const newPasswordInput = screen.getByLabelText(/^New Password/i);
        const confirmPasswordInput = screen.getByLabelText(
            /^Confirm New Password/i,
        );
        const submitBtn = screen.getByRole('button', {
            name: 'Update password',
        });

        fireEvent.change(currentPasswordInput, {
            target: { value: 'CurrentSecret123!' },
        });
        fireEvent.change(newPasswordInput, {
            target: { value: 'BrandNewSecret123!' },
        });
        fireEvent.change(confirmPasswordInput, {
            target: { value: 'BrandNewSecret123!' },
        });

        fireEvent.click(submitBtn);
        expect(submitBtn).toBeInTheDocument();
    });

    it('shows OTP enabled badge when email_otp_enabled is true', () => {
        render(
            <AccountSettings
                {...mockProps}
                current_tab="security"
                security={{ email_otp_enabled: true, has_verified_email: true }}
            />,
        );

        expect(screen.getByText('Enabled')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Disable 2FA/i }),
        ).toBeInTheDocument();
    });

    it('opens 2FA setup modal with modern copy when clicking Enable 2FA', async () => {
        render(<AccountSettings {...mockProps} current_tab="security" />);

        expect(
            screen.getByText(
                'Add an extra layer of security to your account with email verification codes.',
            ),
        ).toBeInTheDocument();

        const enableBtn = screen.getByRole('button', { name: /Enable 2FA/i });
        fireEvent.click(enableBtn);

        expect(
            screen.getByRole('heading', {
                name: /Enable Two-Factor Authentication/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Enter your current password to continue.'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /^Send code$/i }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        await waitFor(() => {
            expect(
                screen.queryByRole('heading', {
                    name: /Enable Two-Factor Authentication/i,
                }),
            ).not.toBeInTheDocument();
        });
    });

    it('opens 2FA disable modal with modern copy when clicking Disable 2FA', async () => {
        render(
            <AccountSettings
                {...mockProps}
                current_tab="security"
                security={{ email_otp_enabled: true, has_verified_email: true }}
            />,
        );

        const disableBtn = screen.getByRole('button', { name: /Disable 2FA/i });
        fireEvent.click(disableBtn);

        expect(
            screen.getByRole('heading', {
                name: /Disable Two-Factor Authentication/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Enter your current password to continue.'),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        await waitFor(() => {
            expect(
                screen.queryByRole('heading', {
                    name: /Disable Two-Factor Authentication/i,
                }),
            ).not.toBeInTheDocument();
        });
    });

    it('opens email change modal when clicking Change email', async () => {
        render(<AccountSettings {...mockProps} current_tab="profile" />);

        const changeEmailBtn = screen.getByRole('button', {
            name: /Change email/i,
        });
        fireEvent.click(changeEmailBtn);

        expect(
            screen.getByRole('heading', { name: /Change Email Address/i }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/^Current Password/i)).toBeInTheDocument();
        expect(
            screen.getByLabelText(/^New Email Address/i),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        await waitFor(() => {
            expect(
                screen.queryByRole('heading', {
                    name: /Change Email Address/i,
                }),
            ).not.toBeInTheDocument();
        });
    });

    it('opens sign out other sessions modal when clicking Sign out other sessions', async () => {
        render(<AccountSettings {...mockProps} current_tab="activity" />);

        const signoutBtn = screen.getByRole('button', {
            name: /Sign out other sessions/i,
        });
        fireEvent.click(signoutBtn);

        expect(
            screen.getByRole('heading', {
                name: /Sign Out Other Sessions/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole('button', {
                name: /^Sign out other sessions$/i,
            }).length,
        ).toBe(2);

        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        await waitFor(() => {
            expect(
                screen.queryByRole('heading', {
                    name: /Sign Out Other Sessions/i,
                }),
            ).not.toBeInTheDocument();
        });
    });

    it('dismisses status feedback message when close button is clicked', () => {
        render(
            <AccountSettings
                {...mockProps}
                status="Profile settings saved successfully."
            />,
        );

        expect(
            screen.getByText('Profile settings saved successfully.'),
        ).toBeInTheDocument();

        const dismissBtn = screen.getByRole('button', {
            name: /Dismiss feedback/i,
        });
        fireEvent.click(dismissBtn);

        expect(
            screen.queryByText('Profile settings saved successfully.'),
        ).not.toBeInTheDocument();
    });

    it('associates phone input with label and enables Save changes on edit', () => {
        render(<AccountSettings {...mockProps} current_tab="profile" />);

        const phoneInput = screen.getByLabelText(/^Phone Number/i);
        expect(phoneInput).toBeInTheDocument();
        expect(phoneInput).toHaveValue('+1 555-0199');

        const saveButton = screen.getByRole('button', {
            name: /Save changes/i,
        });
        // Initially disabled because value is unchanged
        expect(saveButton).toBeDisabled();

        // Type a new phone number
        fireEvent.change(phoneInput, { target: { value: '+1 555-9999' } });
        expect(saveButton).not.toBeDisabled();
    });

    it('renders empty state when there are no active sessions', () => {
        render(
            <AccountSettings
                {...mockProps}
                sessions={[]}
                current_tab="activity"
            />,
        );

        expect(
            screen.getByText('No active sessions recorded.'),
        ).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('deduplicates sessions cleanly when none has is_current set to true', () => {
        const headlessSessions = [
            {
                id: 'sess-a',
                is_current: false,
                ip_address: '1.1.1.1',
                browser: 'Chrome',
                platform: 'ChromiumOS',
                device_type: 'desktop' as const,
                device_label: 'Chrome on ChromiumOS',
                location: 'Sydney, Australia',
                last_active_at: new Date().toISOString(),
                last_active_human: 'Active now',
            },
            {
                id: 'sess-b',
                is_current: false,
                ip_address: '2.2.2.2',
                browser: 'Firefox',
                platform: 'FreeBSD',
                device_type: 'desktop' as const,
                device_label: 'Firefox on FreeBSD',
                location: 'Melbourne, Australia',
                last_active_at: new Date().toISOString(),
                last_active_human: '10 mins ago',
            },
        ];

        render(
            <AccountSettings
                {...mockProps}
                sessions={headlessSessions}
                current_tab="activity"
            />,
        );

        // First session becomes "This device" and should only appear once
        expect(screen.getAllByText('Chrome on ChromiumOS').length).toBe(1);
        expect(screen.getByText('This device')).toBeInTheDocument();

        // Second session is in other sessions with a Revoke button
        expect(screen.getByText('Firefox on FreeBSD')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /Revoke/i }).length).toBe(
            1,
        );
    });

    it('displays clean account status without redundant parenthetical echoes', () => {
        render(
            <AccountSettings
                {...mockProps}
                profile={{
                    ...mockProps.profile,
                    account_status: 'inactive',
                    account_status_label: 'Inactive',
                }}
            />,
        );

        expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(
            1,
        );
        expect(screen.queryByText('(Suspended)')).not.toBeInTheDocument();
        expect(screen.queryByText('(Active)')).not.toBeInTheDocument();
    });

    describe('LocationBadge Component', () => {
        it('renders internal network styling for private/loopback IPs', () => {
            const { container } = render(
                <LocationBadge
                    location="Local Network / Private IP"
                    ip="192.168.1.5"
                />,
            );
            expect(
                screen.getByText('Local Network / Private IP'),
            ).toBeInTheDocument();
            expect(container.querySelector('svg')).toBeInTheDocument();
        });

        it('renders geographic location styling for public IPs', () => {
            render(
                <LocationBadge
                    location="Mountain View, United States"
                    ip="8.8.8.8"
                />,
            );
            expect(
                screen.getByText('Mountain View, United States'),
            ).toBeInTheDocument();
        });

        it('renders graceful fallback for unavailable, empty, or unknown locations', () => {
            const { rerender } = render(
                <LocationBadge location="Unknown Location" ip="10.0.0.1" />,
            );
            expect(screen.getByText('Unknown Location')).toBeInTheDocument();

            rerender(<LocationBadge location="" ip="10.0.0.1" />);
            expect(screen.getByText('Unknown Location')).toBeInTheDocument();

            rerender(<LocationBadge location={null} ip="10.0.0.1" />);
            expect(screen.getByText('Unknown Location')).toBeInTheDocument();
        });
    });
});
