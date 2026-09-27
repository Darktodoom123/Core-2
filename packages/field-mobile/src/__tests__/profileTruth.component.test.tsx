import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import appConfig from '../../app.json';
import { ProfileInfoTab } from '../screens/profile/components/ProfileInfoTab';
import { SettingsSyncTab } from '../screens/profile/components/SettingsSyncTab';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import type { FieldApiClient } from '../services/apiClient';
import { ThemeProvider } from '../theme';
import type { AccountDetailsResponse } from '../types/account';
import type { OutboxCommand } from '../types/index';

const account: AccountDetailsResponse = {
    profile: {
        name: 'Dev Crane Operator',
        username: 'dev.operator',
        email: 'real.operator@core2.test',
        email_verified: false,
        phone: null,
        role: 'crane_operator',
        role_label: 'Crane Operator',
        account_status: 'active',
        account_status_label: 'Active',
        permissions: ['dispatch.read'],
    },
    security: { email_otp_enabled: false, has_verified_email: false },
    trusted_devices: [],
    sessions: [],
    recent_activity: {
        data: [],
        current_page: 1,
        last_page: 1,
        prev_page_url: null,
        next_page_url: null,
        total: 0,
    },
};

const command = (id: string, state: OutboxCommand['state']): OutboxCommand =>
    ({
        id,
        actorId: 1,
        type: 'transition_status',
        jobId: 1,
        payload: {},
        payloadHash: id,
        state,
        attempts: state === 'completed' ? 1 : 0,
        createdAt: '2026-09-28T08:00:00.000Z',
        updatedAt: '2026-09-28T08:00:00.000Z',
        error: null,
    }) as unknown as OutboxCommand;

const inTheme = (node: React.ReactElement) =>
    render(<ThemeProvider initialMode="light">{node}</ThemeProvider>);

afterEach(cleanup);

describe('Profile shows only real account data', () => {
    it('never fills a failed load with a made-up account, and recovers on retry', async () => {
        const getAccountDetails = jest
            .fn()
            .mockRejectedValueOnce(new Error('Network request failed'))
            .mockResolvedValue(account);
        const apiClient = { getAccountDetails } as unknown as FieldApiClient;

        const view = await inTheme(
            <ProfileScreen
                apiClient={apiClient}
                isOnline={false}
                onBack={jest.fn()}
                userName="Dev Crane Operator"
            />,
        );

        expect(view.getByTestId('profile-account-unavailable')).toBeTruthy();
        // No raw network error and no second retry button.
        expect(view.queryByText('Network request failed')).toBeNull();
        expect(view.queryByLabelText('Retry loading profile')).toBeNull();
        expect(view.queryByText('operator@core2.test')).toBeNull();
        expect(view.queryByText('✓ Verified')).toBeNull();
        expect(view.queryByTestId('profile-info-tab')).toBeNull();

        await act(async () => {
            fireEvent.press(view.getByTestId('profile-account-retry'));
        });

        expect(view.getByText('real.operator@core2.test')).toBeTruthy();
        // The error from the failed load is gone once the retry works.
        expect(view.queryByText('Network request failed')).toBeNull();
        expect(view.queryByTestId('profile-account-unavailable')).toBeNull();
    });

    it('keeps Settings usable offline so the operator can still sign out', async () => {
        const apiClient = {
            getAccountDetails: jest
                .fn()
                .mockRejectedValue(new Error('Network request failed')),
        } as unknown as FieldApiClient;
        const view = await inTheme(
            <ProfileScreen
                apiClient={apiClient}
                isOnline={false}
                onBack={jest.fn()}
                onLogout={jest.fn()}
            />,
        );

        await act(async () => {
            fireEvent.press(view.getByTestId('tab-settings'));
        });

        expect(view.getByTestId('settings-sync-tab')).toBeTruthy();
        expect(view.getByTestId('btn-sign-out')).toBeTruthy();
    });

    it('says who is signed in instead of an internal label', async () => {
        const view = await inTheme(
            <ProfileScreen
                apiClient={
                    {
                        getAccountDetails: jest.fn().mockResolvedValue(account),
                    } as unknown as FieldApiClient
                }
                initialAccountData={account}
                onBack={jest.fn()}
                userName="Dev Crane Operator"
            />,
        );

        expect(view.getByText('Signed in as Dev Crane Operator')).toBeTruthy();
        expect(view.queryByText('Core-2 Identity Parity')).toBeNull();
    });

    it('says plainly when no unit is linked', async () => {
        const view = await inTheme(
            <ProfileInfoTab
                apiClient={{} as FieldApiClient}
                onEmailChangeClick={jest.fn()}
                onPhoneUpdated={jest.fn()}
                profile={account.profile}
            />,
        );

        expect(view.getByText('No unit linked')).toBeTruthy();
        expect(view.getByText('Not linked')).toBeTruthy();
        expect(view.queryByText('In-Cab')).toBeNull();
    });

    it('asks for the same 12-character minimum the server enforces', async () => {
        const view = await inTheme(
            <ProfileScreen
                apiClient={
                    {
                        getAccountDetails: jest.fn().mockResolvedValue(account),
                        updatePassword: jest.fn(),
                    } as unknown as FieldApiClient
                }
                initialAccountData={account}
                onBack={jest.fn()}
            />,
        );

        await act(async () => {
            fireEvent.press(view.getByTestId('tab-security'));
        });
        expect(view.getByText('At least 12 characters')).toBeTruthy();

        // Eleven characters with every other rule met is still not enough.
        await act(async () => {
            fireEvent.changeText(
                view.getByTestId('input-current-password'),
                'Old-pass-1',
            );
            fireEvent.changeText(
                view.getByTestId('input-new-password'),
                'Crane-Lif1!',
            );
            fireEvent.changeText(
                view.getByTestId('input-confirm-password'),
                'Crane-Lif1!',
            );
        });

        expect(
            view.getByTestId('btn-update-password').props.accessibilityState
                ?.disabled,
        ).toBe(true);
    });
});

describe('Settings counts only actions that have not synced', () => {
    const renderSettings = (commands: OutboxCommand[]) =>
        inTheme(
            <SettingsSyncTab
                isOnline
                onLogout={jest.fn()}
                onSyncNow={jest.fn()}
                outboxCommands={commands}
                queuedCount={commands.length}
            />,
        );

    it('does not count synced actions on the sync button or the sign-out warning', async () => {
        const view = await renderSettings([
            command('a', 'completed'),
            command('b', 'completed'),
            command('c', 'completed'),
            command('d', 'queued'),
        ]);

        expect(view.getByText(/Sync Outbox Now \(1\)/)).toBeTruthy();

        await act(async () => {
            fireEvent.press(view.getByTestId('btn-sign-out'));
        });

        expect(view.getByText(/You have 1 unsynced action/)).toBeTruthy();
    });

    it('does not warn about unsynced work when everything has synced', async () => {
        const view = await renderSettings([
            command('a', 'completed'),
            command('b', 'completed'),
        ]);

        await act(async () => {
            fireEvent.press(view.getByTestId('btn-sign-out'));
        });

        expect(view.queryByText(/unsynced action/)).toBeNull();
    });

    it('shows the version of the installed build', async () => {
        const view = await renderSettings([]);

        expect(view.getByText(`v${appConfig.expo.version}`)).toBeTruthy();
    });

    it('keeps loaded details on a failed refresh and says so plainly', async () => {
        const getAccountDetails = jest
            .fn()
            .mockRejectedValue(new Error('java.io.IOException: end of stream'));
        const view = await inTheme(
            <ProfileScreen
                apiClient={{ getAccountDetails } as unknown as FieldApiClient}
                initialAccountData={account}
                onBack={jest.fn()}
            />,
        );

        expect(view.getByText('real.operator@core2.test')).toBeTruthy();
        expect(
            view.getByText(
                "Couldn't refresh your account. Showing the details last loaded.",
            ),
        ).toBeTruthy();
        expect(view.queryByText(/IOException/)).toBeNull();
    });
});
