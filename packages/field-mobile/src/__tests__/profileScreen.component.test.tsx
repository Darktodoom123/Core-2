import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import { Alert } from 'react-native';
import { AssignedJobsListScreen } from '../screens/AssignedJobsListScreen';
import { OperatorDashboardScreen } from '../screens/OperatorDashboardScreen';
import { ProfileInfoTab } from '../screens/profile/components/ProfileInfoTab';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import type { FieldApiClient } from '../services/apiClient';
import { ThemeProvider } from '../theme';
import type { AccountDetailsResponse } from '../types/account';

const mockAccountData: AccountDetailsResponse = {
    profile: {
        name: 'Dev Crane Operator',
        username: 'dev.operator',
        email: 'dev.operator@core2.test',
        email_verified: true,
        phone: '+15551234567',
        role: 'crane_operator',
        role_label: 'Crane Operator',
        account_status: 'active',
        account_status_label: 'Active',
        permissions: ['dispatch.read', 'dvir.execute', 'hos.log'],
    },
    security: {
        email_otp_enabled: false,
        has_verified_email: true,
    },
    trusted_devices: [
        {
            id: 'dev-1',
            device_label: 'Field Android Tablet',
            platform: 'Android',
            ip_address: '192.168.1.10',
            location: 'Manila, Philippines',
            is_current: true,
            last_used_at: '2026-09-19T10:00:00Z',
            last_used_human: 'Just now',
            expires_at: '2026-10-19T10:00:00Z',
            expires_human: 'in 30 days',
        },
    ],
    sessions: [
        {
            id: 'sess-1',
            is_current: true,
            ip_address: '192.168.1.10',
            browser: 'Core-2 Mobile Client',
            platform: 'Android',
            device_type: 'tablet',
            device_label: 'Field Android Tablet',
            location: 'Manila, Philippines',
            last_active_at: '2026-09-19T10:00:00Z',
            last_active_human: 'Just now',
        },
        {
            id: 'sess-2',
            is_current: false,
            ip_address: '192.168.1.15',
            browser: 'Chrome 120',
            platform: 'Windows',
            device_type: 'desktop',
            device_label: 'Dispatcher Desktop',
            location: 'Cebu, Philippines',
            last_active_at: '2026-09-18T15:00:00Z',
            last_active_human: '1 day ago',
        },
    ],
    recent_activity: {
        data: [
            {
                id: 101,
                action: 'user.login',
                event_label: 'Signed in',
                outcome: 'success',
                ip_address: '192.168.1.10',
                device_label: 'Field Android Tablet',
                location: 'Manila, Philippines',
                occurred_at: '2026-09-19T10:00:00Z',
                occurred_at_human: 'Just now',
            },
        ],
        current_page: 1,
        last_page: 1,
        prev_page_url: null,
        next_page_url: null,
        total: 1,
    },
};

const createMockApiClient = (
    overrides?: Partial<FieldApiClient>,
): FieldApiClient =>
    ({
        getAccountDetails: jest.fn().mockResolvedValue(mockAccountData),
        updateAccountProfile: jest.fn().mockResolvedValue({
            message: 'Profile contact details updated successfully.',
            phone: '+15559876543',
        }),
        updatePassword: jest.fn().mockResolvedValue({
            message: 'Password updated successfully.',
        }),
        changeAccountPassword: jest.fn().mockResolvedValue({
            message: 'Password updated successfully.',
        }),
        requestEmailChange: jest.fn().mockResolvedValue({
            message: 'Code sent',
            challenge_id: 'email-challenge-123',
            cooldown_seconds: 45,
        }),
        verifyEmailChange: jest.fn().mockResolvedValue({
            message: 'Email updated successfully',
        }),
        requestEnableOtp: jest.fn().mockResolvedValue({
            message: 'Code sent',
            challenge_id: 'otp-enable-123',
            cooldown_seconds: 45,
        }),
        confirmEnableOtp: jest.fn().mockResolvedValue({
            message: '2FA enabled',
            email_otp_enabled: true,
        }),
        requestDisableOtp: jest.fn().mockResolvedValue({
            message: 'Code sent',
            challenge_id: 'otp-disable-123',
        }),
        confirmDisableOtp: jest.fn().mockResolvedValue({
            message: '2FA disabled',
            email_otp_enabled: false,
        }),
        resendOtp: jest.fn().mockResolvedValue({
            message: 'Code resent',
            challenge_id: 'otp-new-123',
            cooldown_seconds: 45,
        }),
        revokeSession: jest.fn().mockResolvedValue({
            message: 'Session revoked successfully.',
        }),
        revokeOtherSessions: jest.fn().mockResolvedValue({
            message: 'All other sessions have been signed out.',
        }),
        revokeTrustedDevice: jest.fn().mockResolvedValue({
            message: 'Trusted device revoked.',
        }),
        revokeAllTrustedDevices: jest.fn().mockResolvedValue({
            message: 'All trusted devices have been revoked.',
        }),
        markDeviceLost: jest.fn().mockResolvedValue({
            message: 'Device marked as lost.',
        }),
        getAccountActivity: jest
            .fn()
            .mockResolvedValue(mockAccountData.recent_activity),
        ...overrides,
    }) as unknown as FieldApiClient;

describe('ProfileScreen component tests', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders top bar, status badge, and 4 segmented navigation tabs', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    assignedAssetLabel="MC-04 · Liebherr LTM 1090"
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        expect(view.getByTestId('profile-screen')).toBeTruthy();
        expect(view.getByText('Account & Security')).toBeTruthy();
        expect(view.getByText('Core-2 Identity Parity')).toBeTruthy();
        expect(view.getByText('Online')).toBeTruthy();

        // 4 segmented tabs present
        expect(view.getByTestId('tab-profile')).toBeTruthy();
        expect(view.getByTestId('tab-security')).toBeTruthy();
        expect(view.getByTestId('tab-activity')).toBeTruthy();
        expect(view.getByTestId('tab-settings')).toBeTruthy();

        // Initially on profile tab
        expect(view.getByTestId('profile-info-tab')).toBeTruthy();
    });

    it('renders ProfileInfoTab directly with identity card and permissions', async () => {
        const apiClient = createMockApiClient();
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileInfoTab
                    apiClient={apiClient}
                    assignedAssetLabel="MC-04 · Liebherr LTM 1090"
                    isOnline={true}
                    onEmailChangeClick={jest.fn()}
                    onPhoneUpdated={jest.fn()}
                    profile={mockAccountData.profile}
                />
            </ThemeProvider>,
        );
        expect(view.getByTestId('profile-info-tab')).toBeTruthy();
        expect(view.getByText('Dev Crane Operator')).toBeTruthy();
        expect(view.getByText('DC')).toBeTruthy();
        expect(view.getByText('MC-04 · Liebherr LTM 1090')).toBeTruthy();
        expect(view.getByText('dev.operator@core2.test')).toBeTruthy();
    });

    it('displays operator identity card, assigned asset, and handles inline phone editing', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    assignedAssetLabel="MC-04 · Liebherr LTM 1090"
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        expect(view.getByText('Dev Crane Operator')).toBeTruthy();
        expect(view.getByText('DC')).toBeTruthy();
        expect(view.getByText('MC-04 · Liebherr LTM 1090')).toBeTruthy();
        expect(view.getByText('dev.operator@core2.test')).toBeTruthy();

        // Click edit phone button
        const editPhoneBtn = view.getByTestId('profile-edit-phone-btn');
        await act(async () => {
            fireEvent.press(editPhoneBtn);
        });

        // Phone input should now be visible
        const phoneInput = view.getByTestId('profile-phone-input');
        expect(phoneInput).toBeTruthy();

        // Type new phone number
        await act(async () => {
            fireEvent.changeText(phoneInput, '+15559876543');
        });

        // Click save phone button
        const savePhoneBtn = view.getByTestId('btn-save-phone');
        await act(async () => {
            fireEvent.press(savePhoneBtn);
        });

        expect(apiClient.updateAccountProfile).toHaveBeenCalledWith({
            phone: '+15559876543',
        });
    });

    it('navigates to Security tab, renders password form, 2FA status, and trusted devices', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // Switch to Security tab
        const secTabBtn = view.getByTestId('tab-security');
        await act(async () => {
            fireEvent.press(secTabBtn);
        });

        // Security tab content visible
        expect(view.getByTestId('security-tab')).toBeTruthy();
        expect(view.getByText('Change Password')).toBeTruthy();
        expect(view.getByTestId('input-current-password')).toBeTruthy();
        expect(view.getByTestId('input-new-password')).toBeTruthy();
        expect(view.getByTestId('input-confirm-password')).toBeTruthy();
        expect(view.getByTestId('btn-update-password')).toBeTruthy();

        // 2FA status card
        expect(view.getByText('Two-Factor Authentication')).toBeTruthy();
        expect(view.getByTestId('btn-toggle-2fa')).toBeTruthy();
        expect(view.getByText('Enable 2FA')).toBeTruthy();

        // Trusted devices card
        expect(view.getByText(/Trusted Devices/)).toBeTruthy();
        expect(view.getByTestId('device-item-dev-1')).toBeTruthy();
        expect(view.getByText('Field Android Tablet')).toBeTruthy();
    });

    it('submits password change through SecurityTab and calls apiClient.updatePassword', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // Switch to Security tab
        const secTabBtn = view.getByTestId('tab-security');
        await act(async () => {
            fireEvent.press(secTabBtn);
        });

        // Fill inputs
        const currentInput = view.getByTestId('input-current-password');
        const newInput = view.getByTestId('input-new-password');
        const confirmInput = view.getByTestId('input-confirm-password');

        await act(async () => {
            fireEvent.changeText(currentInput, 'OldPassword123!');
            fireEvent.changeText(newInput, 'StrongPassword123!');
            fireEvent.changeText(confirmInput, 'StrongPassword123!');
        });

        // Press update password button
        const updateBtn = view.getByTestId('btn-update-password');
        await act(async () => {
            fireEvent.press(updateBtn);
        });

        expect(apiClient.updatePassword).toHaveBeenCalledWith({
            currentPassword: 'OldPassword123!',
            newPassword: 'StrongPassword123!',
            confirmation: 'StrongPassword123!',
        });
        expect(view.getByText('Password updated successfully.')).toBeTruthy();
    });

    it('verifies all 21 mandated contract testIDs across the Profile & Settings flow', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // 1. Root and Nav elements
        expect(view.getByTestId('profile-screen')).toBeTruthy();
        expect(view.getByTestId('profile-screen-back')).toBeTruthy();
        expect(view.getByTestId('tab-profile')).toBeTruthy();
        expect(view.getByTestId('tab-security')).toBeTruthy();
        expect(view.getByTestId('tab-activity')).toBeTruthy();
        expect(view.getByTestId('tab-settings')).toBeTruthy();

        // 2. Profile Info Tab elements
        expect(view.getByTestId('profile-info-tab')).toBeTruthy();
        expect(view.getByTestId('btn-change-email')).toBeTruthy();

        // Trigger inline edit phone to reveal btn-save-phone
        const editPhoneBtn = view.getByTestId('profile-edit-phone-btn');
        await act(async () => {
            fireEvent.press(editPhoneBtn);
        });
        expect(view.getByTestId('btn-save-phone')).toBeTruthy();

        // 3. Security Tab elements
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-security'));
        });
        expect(view.getByTestId('security-tab')).toBeTruthy();
        expect(view.getByTestId('btn-toggle-2fa')).toBeTruthy();
        expect(view.getByTestId('input-current-password')).toBeTruthy();
        expect(view.getByTestId('input-new-password')).toBeTruthy();
        expect(view.getByTestId('input-confirm-password')).toBeTruthy();
        expect(view.getByTestId('btn-update-password')).toBeTruthy();

        // 4. Activity Tab elements
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-activity'));
        });
        expect(view.getByTestId('activity-tab')).toBeTruthy();
        expect(view.getByTestId('btn-revoke-others')).toBeTruthy();

        // 5. Settings / Sync Tab elements
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-settings'));
        });
        expect(view.getByTestId('settings-sync-tab')).toBeTruthy();
        expect(view.getByTestId('theme-option-light')).toBeTruthy();
        expect(view.getByTestId('theme-option-dark')).toBeTruthy();
        expect(view.getByTestId('btn-sign-out')).toBeTruthy();
    });

    it('navigates to Activity tab and displays active sessions and security activity', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // Switch to Activity tab
        const actTabBtn = view.getByTestId('tab-activity');
        await act(async () => {
            fireEvent.press(actTabBtn);
        });

        expect(view.getByTestId('activity-tab')).toBeTruthy();
        expect(view.getByText('Security Activity Log')).toBeTruthy();
        expect(view.getByText('This Device')).toBeTruthy();
        expect(view.getByTestId('session-item-sess-2')).toBeTruthy();
        expect(view.getByTestId('activity-item-101')).toBeTruthy();
        expect(view.getByText('Signed in')).toBeTruthy();
    });

    it('navigates to Settings tab, tests theme selector, outbox sync, push alerts, and sign-out', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();
        const onSyncNow = jest.fn();
        const onLogout = jest.fn();
        const onRequestPushPermissions = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    onLogout={onLogout}
                    onRequestPushPermissions={onRequestPushPermissions}
                    onSyncNow={onSyncNow}
                    pushNotificationsEnabled={false}
                    queuedCount={2}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // Switch to Settings tab
        const setTabBtn = view.getByTestId('tab-settings');
        await act(async () => {
            fireEvent.press(setTabBtn);
        });

        expect(view.getByTestId('settings-sync-tab')).toBeTruthy();
        expect(view.getByTestId('theme-selector-card')).toBeTruthy();
        expect(view.getByTestId('theme-option-light')).toBeTruthy();
        expect(view.getByTestId('theme-option-dark')).toBeTruthy();

        // Switch theme to light
        await act(async () => {
            fireEvent.press(view.getByTestId('theme-option-light'));
        });

        // Sync outbox
        const syncBtn = view.getByTestId('sync-outbox-now-btn');
        await act(async () => {
            fireEvent.press(syncBtn);
        });
        expect(onSyncNow).toHaveBeenCalledTimes(1);

        // Enable push alerts
        const pushBtn = view.getByTestId('enable-push-btn');
        await act(async () => {
            fireEvent.press(pushBtn);
        });
        expect(onRequestPushPermissions).toHaveBeenCalledTimes(1);

        // Sign out button
        const signOutBtn = view.getByTestId('btn-sign-out');
        await act(async () => {
            fireEvent.press(signOutBtn);
        });

        // Sign out modal should appear
        expect(view.getByTestId('profile-sign-out-modal')).toBeTruthy();
        expect(view.getByText('Sign out of the field app?')).toBeTruthy();

        // Confirm sign out
        const confirmSignOutBtn = view.getByTestId('confirm-profile-sign-out');
        await act(async () => {
            fireEvent.press(confirmSignOutBtn);
        });
        expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it('triggers onBack when the back button is pressed', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        const backBtn = view.getByTestId('profile-screen-back');
        await act(async () => {
            fireEvent.press(backBtn);
        });

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('opens email change modal from profile tab and 2FA modal from security tab', async () => {
        const apiClient = createMockApiClient();
        const onBack = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={onBack}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // Click Change Email button in Profile tab
        const changeEmailBtn = view.getByTestId('btn-change-email');
        await act(async () => {
            fireEvent.press(changeEmailBtn);
        });

        // Email change modal appears
        expect(view.getByTestId('email-change-modal')).toBeTruthy();
        expect(view.getByText('Change Email Address')).toBeTruthy();

        // Close email modal
        const closeEmailBtn = view.getByTestId('email-change-cancel-btn');
        await act(async () => {
            fireEvent.press(closeEmailBtn);
        });

        // Switch to Security tab
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-security'));
        });

        // Click 2FA toggle button
        const otpToggleBtn = view.getByTestId('btn-toggle-2fa');
        await act(async () => {
            fireEvent.press(otpToggleBtn);
        });

        // 2FA modal appears
        expect(view.getByTestId('otp-security-modal')).toBeTruthy();
        expect(view.getByText('Enable Two-Factor Authentication')).toBeTruthy();

        // Close 2FA modal
        const closeOtpBtn = view.getByTestId('otp-modal-cancel-btn');
        await act(async () => {
            fireEvent.press(closeOtpBtn);
        });
    });

    it('enforces 2FA for system administrators and displays organizational policy notice', async () => {
        const adminAccountData: AccountDetailsResponse = {
            ...mockAccountData,
            profile: {
                ...mockAccountData.profile,
                role: 'system_administrator',
                role_label: 'System Administrator',
            },
            security: {
                email_otp_enabled: true,
                has_verified_email: true,
            },
        };

        const apiClient = createMockApiClient({
            getAccountDetails: jest.fn().mockResolvedValue(adminAccountData),
        });

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={adminAccountData}
                    isOnline={true}
                    onBack={jest.fn()}
                    userName="Dev Admin"
                    userRole="system_administrator"
                />
            </ThemeProvider>,
        );

        // Switch to Security tab
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-security'));
        });

        // 2FA button should show "Enforced" and policy notice should be visible
        expect(view.getByText('Enforced')).toBeTruthy();
        expect(view.getByTestId('admin-2fa-policy-notice')).toBeTruthy();
        expect(
            view.getByText(
                'Mandatory for System Administrators by organizational policy.',
            ),
        ).toBeTruthy();

        // Clicking the enforced button should not trigger modal
        await act(async () => {
            fireEvent.press(view.getByTestId('btn-toggle-2fa'));
        });
        expect(view.queryByTestId('otp-security-modal')).toBeNull();
    });

    it('prompts confirmation dialog when revoking single session in Activity tab and proceeds on confirm', async () => {
        const apiClient = createMockApiClient();
        const alertSpy = jest.spyOn(Alert, 'alert');

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={jest.fn()}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // Switch to Activity tab
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-activity'));
        });

        // Press Sign Out on sess-2
        const revokeBtn = view.getByTestId('revoke-session-sess-2');
        await act(async () => {
            fireEvent.press(revokeBtn);
        });

        expect(alertSpy).toHaveBeenCalledWith(
            'Sign Out Session',
            expect.stringContaining('Dispatcher Desktop'),
            expect.any(Array),
        );

        // Execute confirm action from alert buttons
        const alertButtons = alertSpy.mock.calls[0][2] as any[];
        const confirmBtn = alertButtons.find((b) => b.text === 'Sign Out');
        expect(confirmBtn).toBeTruthy();

        await act(async () => {
            confirmBtn.onPress();
        });

        expect(apiClient.revokeSession).toHaveBeenCalledWith('sess-2');
        alertSpy.mockRestore();
    });

    it('prompts confirmation dialog when revoking trusted device in Security tab', async () => {
        const apiClient = createMockApiClient();
        const alertSpy = jest.spyOn(Alert, 'alert');

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={jest.fn()}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // Switch to Security tab
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-security'));
        });

        // Press Revoke Trust on dev-1
        const revokeDevBtn = view.getByTestId('revoke-device-dev-1');
        await act(async () => {
            fireEvent.press(revokeDevBtn);
        });

        expect(alertSpy).toHaveBeenCalledWith(
            'Revoke Trusted Device',
            expect.stringContaining('Field Android Tablet'),
            expect.any(Array),
        );

        const alertButtons = alertSpy.mock.calls[0][2] as any[];
        const confirmBtn = alertButtons.find((b) => b.text === 'Revoke');
        expect(confirmBtn).toBeTruthy();

        await act(async () => {
            confirmBtn.onPress();
        });

        expect(apiClient.revokeTrustedDevice).toHaveBeenCalledWith('dev-1');
        alertSpy.mockRestore();
    });

    it('displays error message inside ConfirmPasswordModal when revoking other sessions fails', async () => {
        const apiClient = createMockApiClient({
            revokeOtherSessions: jest
                .fn()
                .mockRejectedValue(
                    new Error(
                        'The provided password does not match our records.',
                    ),
                ),
        });

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileScreen
                    apiClient={apiClient}
                    initialAccountData={mockAccountData}
                    isOnline={true}
                    onBack={jest.fn()}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                />
            </ThemeProvider>,
        );

        // Switch to Activity tab
        await act(async () => {
            fireEvent.press(view.getByTestId('tab-activity'));
        });

        // Press Sign Out Others
        await act(async () => {
            fireEvent.press(view.getByTestId('btn-revoke-others'));
        });

        // Confirm password modal is visible
        expect(view.getByTestId('confirm-password-modal')).toBeTruthy();

        // Enter wrong password
        const passwordInput = view.getByTestId('confirm-password-input');
        await act(async () => {
            fireEvent.changeText(passwordInput, 'WrongPass123');
        });

        // Submit
        const submitBtn = view.getByTestId('confirm-password-submit');
        await act(async () => {
            fireEvent.press(submitBtn);
        });

        // Modal stays visible and displays the server error message
        expect(view.getByTestId('confirm-password-modal')).toBeTruthy();
        expect(
            view.getByText('The provided password does not match our records.'),
        ).toBeTruthy();
    });

    describe('Profile navigation wiring in AssignedJobsListScreen and OperatorDashboardScreen', () => {
        it('AssignedJobsListScreen invokes onOpenProfile when operator profile avatar is tapped', async () => {
            const onOpenProfile = jest.fn();
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <AssignedJobsListScreen
                        isLoading={false}
                        jobs={[]}
                        onOpenProfile={onOpenProfile}
                        onRefresh={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Dev Crane Operator"
                    />
                </ThemeProvider>,
            );

            const profileBtn = view.getByTestId('profile-button');
            await act(async () => {
                fireEvent.press(profileBtn);
            });

            expect(onOpenProfile).toHaveBeenCalledTimes(1);
        });

        it('AssignedJobsListScreen falls back to onOpenAccountSettings when onOpenProfile is not provided', async () => {
            const onOpenAccountSettings = jest.fn();
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <AssignedJobsListScreen
                        isLoading={false}
                        jobs={[]}
                        onOpenAccountSettings={onOpenAccountSettings}
                        onRefresh={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Dev Crane Operator"
                    />
                </ThemeProvider>,
            );

            const profileBtn = view.getByTestId('profile-button');
            await act(async () => {
                fireEvent.press(profileBtn);
            });

            expect(onOpenAccountSettings).toHaveBeenCalledTimes(1);
        });

        it('AssignedJobsListScreen routes bottom navigation profile tap to onOpenProfile', async () => {
            const onOpenProfile = jest.fn();
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <AssignedJobsListScreen
                        isLoading={false}
                        jobs={[]}
                        onOpenProfile={onOpenProfile}
                        onRefresh={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Dev Crane Operator"
                    />
                </ThemeProvider>,
            );

            const navProfileBtn = view.getByTestId('bottom-nav-profile');
            await act(async () => {
                fireEvent.press(navProfileBtn);
            });

            expect(onOpenProfile).toHaveBeenCalledTimes(1);
        });

        it('OperatorDashboardScreen routes header settings button to onOpenProfile or fallback', async () => {
            const onOpenProfile = jest.fn();
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <OperatorDashboardScreen
                        isLoading={false}
                        isOnline={true}
                        jobs={[]}
                        onDiscardCommand={jest.fn()}
                        onLogout={jest.fn()}
                        onOpenDocuments={jest.fn()}
                        onOpenDvir={jest.fn()}
                        onOpenForms={jest.fn()}
                        onOpenProfile={onOpenProfile}
                        onOpenRental={jest.fn()}
                        onOpenRoutes={jest.fn()}
                        onOpenSales={jest.fn()}
                        onOpenVehicle={jest.fn()}
                        onRefresh={jest.fn()}
                        onRetryCommand={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Alex Rivera"
                    />
                </ThemeProvider>,
            );

            const settingsBtn = view.getByTestId('btn-profile-settings');
            await act(async () => {
                fireEvent.press(settingsBtn);
            });

            expect(onOpenProfile).toHaveBeenCalledTimes(1);
        });

        it('OperatorDashboardScreen falls back to onOpenAccountSettings when onOpenProfile is not provided', async () => {
            const onOpenAccountSettings = jest.fn();
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <OperatorDashboardScreen
                        isLoading={false}
                        isOnline={true}
                        jobs={[]}
                        onDiscardCommand={jest.fn()}
                        onLogout={jest.fn()}
                        onOpenAccountSettings={onOpenAccountSettings}
                        onOpenDocuments={jest.fn()}
                        onOpenDvir={jest.fn()}
                        onOpenForms={jest.fn()}
                        onOpenRental={jest.fn()}
                        onOpenRoutes={jest.fn()}
                        onOpenSales={jest.fn()}
                        onOpenVehicle={jest.fn()}
                        onRefresh={jest.fn()}
                        onRetryCommand={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Alex Rivera"
                    />
                </ThemeProvider>,
            );

            const settingsBtn = view.getByTestId('btn-profile-settings');
            await act(async () => {
                fireEvent.press(settingsBtn);
            });

            expect(onOpenAccountSettings).toHaveBeenCalledTimes(1);
        });

        it('OperatorDashboardScreen routes bottom nav profile tap to onOpenProfile', async () => {
            const onOpenProfile = jest.fn();
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <OperatorDashboardScreen
                        isLoading={false}
                        isOnline={true}
                        jobs={[]}
                        onDiscardCommand={jest.fn()}
                        onLogout={jest.fn()}
                        onOpenDocuments={jest.fn()}
                        onOpenDvir={jest.fn()}
                        onOpenForms={jest.fn()}
                        onOpenProfile={onOpenProfile}
                        onOpenRental={jest.fn()}
                        onOpenRoutes={jest.fn()}
                        onOpenSales={jest.fn()}
                        onOpenVehicle={jest.fn()}
                        onRefresh={jest.fn()}
                        onRetryCommand={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Alex Rivera"
                    />
                </ThemeProvider>,
            );

            const navProfileBtn = view.getByTestId('bottom-nav-profile');
            await act(async () => {
                fireEvent.press(navProfileBtn);
            });

            expect(onOpenProfile).toHaveBeenCalledTimes(1);
        });

        it('AssignedJobsListScreen falls back to ProfileSheet when neither onOpenProfile nor onOpenAccountSettings is provided', async () => {
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <AssignedJobsListScreen
                        isLoading={false}
                        jobs={[]}
                        onRefresh={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Dev Crane Operator"
                    />
                </ThemeProvider>,
            );

            expect(view.queryByTestId('profile-sheet')).toBeNull();

            const profileBtn = view.getByTestId('profile-button');
            await act(async () => {
                fireEvent.press(profileBtn);
            });

            expect(view.getByTestId('profile-sheet')).toBeTruthy();
        });

        it('AssignedJobsListScreen bottom nav falls back to ProfileSheet when neither handler is provided', async () => {
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <AssignedJobsListScreen
                        isLoading={false}
                        jobs={[]}
                        onRefresh={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Dev Crane Operator"
                    />
                </ThemeProvider>,
            );

            expect(view.queryByTestId('profile-sheet')).toBeNull();

            const navProfileBtn = view.getByTestId('bottom-nav-profile');
            await act(async () => {
                fireEvent.press(navProfileBtn);
            });

            expect(view.getByTestId('profile-sheet')).toBeTruthy();
        });

        it('OperatorDashboardScreen falls back to ProfileSheet when neither handler is provided', async () => {
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <OperatorDashboardScreen
                        isLoading={false}
                        isOnline={true}
                        jobs={[]}
                        onDiscardCommand={jest.fn()}
                        onLogout={jest.fn()}
                        onOpenDocuments={jest.fn()}
                        onOpenDvir={jest.fn()}
                        onOpenForms={jest.fn()}
                        onOpenRental={jest.fn()}
                        onOpenRoutes={jest.fn()}
                        onOpenSales={jest.fn()}
                        onOpenVehicle={jest.fn()}
                        onRefresh={jest.fn()}
                        onRetryCommand={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Alex Rivera"
                    />
                </ThemeProvider>,
            );

            expect(view.queryByTestId('profile-sheet')).toBeNull();

            const settingsBtn = view.getByTestId('btn-profile-settings');
            await act(async () => {
                fireEvent.press(settingsBtn);
            });

            expect(view.getByTestId('profile-sheet')).toBeTruthy();
        });

        it('OperatorDashboardScreen bottom nav falls back to ProfileSheet when neither handler is provided', async () => {
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <OperatorDashboardScreen
                        isLoading={false}
                        isOnline={true}
                        jobs={[]}
                        onDiscardCommand={jest.fn()}
                        onLogout={jest.fn()}
                        onOpenDocuments={jest.fn()}
                        onOpenDvir={jest.fn()}
                        onOpenForms={jest.fn()}
                        onOpenRental={jest.fn()}
                        onOpenRoutes={jest.fn()}
                        onOpenSales={jest.fn()}
                        onOpenVehicle={jest.fn()}
                        onRefresh={jest.fn()}
                        onRetryCommand={jest.fn()}
                        onSelectJob={jest.fn()}
                        onSosHoldComplete={jest.fn()}
                        outboxCommands={[]}
                        userName="Alex Rivera"
                    />
                </ThemeProvider>,
            );

            expect(view.queryByTestId('profile-sheet')).toBeNull();

            const navProfileBtn = view.getByTestId('bottom-nav-profile');
            await act(async () => {
                fireEvent.press(navProfileBtn);
            });

            expect(view.getByTestId('profile-sheet')).toBeTruthy();
        });
    });
});
