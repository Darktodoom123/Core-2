import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import { ProfileSheet } from '../components/sheets/profile-sheet';
import { ThemeProvider } from '../theme';

describe('ProfileSheet component tests', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders certified operator identity card with initials, role, asset badge, and online status', async () => {
        const onClose = jest.fn();
        const onStartSignOut = jest.fn();
        const onCancelSignOut = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileSheet
                    assignedAssetLabel="MC-04 · Liebherr LTM 1090"
                    isOnline={true}
                    onCancelSignOut={onCancelSignOut}
                    onClose={onClose}
                    onStartSignOut={onStartSignOut}
                    queuedCount={0}
                    signOutConfirmationOpen={false}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                    visible={true}
                />
            </ThemeProvider>,
        );

        expect(view.getByText('Profile')).toBeTruthy();
        expect(view.getByText('Dev Crane Operator')).toBeTruthy();
        expect(view.getByText('crane operator')).toBeTruthy();
        expect(view.getByText('DC')).toBeTruthy();
        expect(view.getByText('MC-04 · Liebherr LTM 1090')).toBeTruthy();
        expect(view.getByText('In-Cab')).toBeTruthy();
        expect(view.getByText('Online')).toBeTruthy();
        expect(view.getByText('✓ All actions synced')).toBeTruthy();
        expect(view.getByText('v1.0.0 (Core-2 Field Mobile)')).toBeTruthy();
    });

    it('renders in-cab standby unit fallback when no asset is assigned', async () => {
        const onClose = jest.fn();
        const onStartSignOut = jest.fn();
        const onCancelSignOut = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <ProfileSheet
                    assignedAssetLabel={null}
                    isOnline={false}
                    onCancelSignOut={onCancelSignOut}
                    onClose={onClose}
                    onStartSignOut={onStartSignOut}
                    queuedCount={3}
                    signOutConfirmationOpen={false}
                    userName="Alex Reyes"
                    userRole="field_driver"
                    visible={true}
                />
            </ThemeProvider>,
        );

        expect(view.getByText('In-Cab Standby (Unassigned)')).toBeTruthy();
        expect(view.getByText('Standby')).toBeTruthy();
        expect(view.getByText('Offline (Saved locally)')).toBeTruthy();
        expect(view.getByText('⏳ 3 unsynced actions')).toBeTruthy();
    });

    it('triggers onSyncNow when unsynced items are present and sync button is pressed', async () => {
        const onClose = jest.fn();
        const onStartSignOut = jest.fn();
        const onCancelSignOut = jest.fn();
        const onSyncNow = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileSheet
                    isOnline={true}
                    onCancelSignOut={onCancelSignOut}
                    onClose={onClose}
                    onStartSignOut={onStartSignOut}
                    onSyncNow={onSyncNow}
                    queuedCount={2}
                    signOutConfirmationOpen={false}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                    visible={true}
                />
            </ThemeProvider>,
        );

        const syncBtn = view.getByLabelText('Sync queued outbox items');
        expect(syncBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(syncBtn);
        });

        expect(onSyncNow).toHaveBeenCalledTimes(1);
    });

    it('starts sign out when Start sign out button is pressed', async () => {
        const onClose = jest.fn();
        const onStartSignOut = jest.fn();
        const onCancelSignOut = jest.fn();
        const onLogout = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileSheet
                    isOnline={true}
                    onCancelSignOut={onCancelSignOut}
                    onClose={onClose}
                    onLogout={onLogout}
                    onStartSignOut={onStartSignOut}
                    queuedCount={0}
                    signOutConfirmationOpen={false}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                    visible={true}
                />
            </ThemeProvider>,
        );

        const startSignOutBtn = view.getByTestId('account-sign-out-button');
        expect(startSignOutBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(startSignOutBtn);
        });

        expect(onStartSignOut).toHaveBeenCalledTimes(1);
    });

    it('renders confirmation dialog with unsynced warning and handles cancel / confirm actions', async () => {
        const onClose = jest.fn();
        const onStartSignOut = jest.fn();
        const onCancelSignOut = jest.fn();
        const onLogout = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileSheet
                    isOnline={true}
                    onCancelSignOut={onCancelSignOut}
                    onClose={onClose}
                    onLogout={onLogout}
                    onStartSignOut={onStartSignOut}
                    queuedCount={4}
                    signOutConfirmationOpen={true}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                    visible={true}
                />
            </ThemeProvider>,
        );

        expect(view.getByText('Sign out of the field app?')).toBeTruthy();
        expect(
            view.getByText(
                'You have 4 unsynced action(s) stored on this device. Signing out will pause syncing until you log back in.',
            ),
        ).toBeTruthy();

        const cancelBtn = view.getByTestId('cancel-sign-out-button');
        await act(async () => {
            fireEvent.press(cancelBtn);
        });
        expect(onCancelSignOut).toHaveBeenCalledTimes(1);

        const confirmBtn = view.getByTestId('confirm-sign-out-button');
        await act(async () => {
            fireEvent.press(confirmBtn);
        });
        expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it('triggers onClose when the circular close button is pressed', async () => {
        const onClose = jest.fn();
        const onStartSignOut = jest.fn();
        const onCancelSignOut = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileSheet
                    isOnline={true}
                    onCancelSignOut={onCancelSignOut}
                    onClose={onClose}
                    onStartSignOut={onStartSignOut}
                    signOutConfirmationOpen={false}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                    visible={true}
                />
            </ThemeProvider>,
        );

        const closeBtn = view.getByTestId('profile-sheet-close');
        expect(closeBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(closeBtn);
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders active push notification status when pushNotificationsEnabled is true', async () => {
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileSheet
                    isOnline={true}
                    onCancelSignOut={jest.fn()}
                    onClose={jest.fn()}
                    onStartSignOut={jest.fn()}
                    signOutConfirmationOpen={false}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                    visible={true}
                    pushNotificationsEnabled={true}
                />
            </ThemeProvider>,
        );

        expect(view.getByText('Push Alerts:')).toBeTruthy();
        expect(view.getByText('Active')).toBeTruthy();
    });

    it('renders disabled push notification status with enable button and calls onRequestPushPermissions when clicked', async () => {
        const onRequestPushPermissions = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileSheet
                    isOnline={true}
                    onCancelSignOut={jest.fn()}
                    onClose={jest.fn()}
                    onStartSignOut={jest.fn()}
                    signOutConfirmationOpen={false}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                    visible={true}
                    pushNotificationsEnabled={false}
                    onRequestPushPermissions={onRequestPushPermissions}
                />
            </ThemeProvider>,
        );

        expect(view.getByText('Push Alerts:')).toBeTruthy();
        expect(view.getByText('Disabled')).toBeTruthy();

        const enableBtn = view.getByTestId('enable-push-button');
        expect(enableBtn).toBeTruthy();
        expect(view.getByText('Enable Push Alerts')).toBeTruthy();

        await act(async () => {
            fireEvent.press(enableBtn);
        });

        expect(onRequestPushPermissions).toHaveBeenCalledTimes(1);
    });

    it('renders account & security gateway button and invokes onOpenAccountSettings and onClose on press', async () => {
        const onClose = jest.fn();
        const onOpenAccountSettings = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <ProfileSheet
                    isOnline={true}
                    onCancelSignOut={jest.fn()}
                    onClose={onClose}
                    onOpenAccountSettings={onOpenAccountSettings}
                    onStartSignOut={jest.fn()}
                    signOutConfirmationOpen={false}
                    userName="Dev Crane Operator"
                    userRole="crane_operator"
                    visible={true}
                />
            </ThemeProvider>,
        );

        const gatewayBtn = view.getByTestId('open-account-settings-btn');
        expect(gatewayBtn).toBeTruthy();
        expect(view.getByText('Account & Security Settings')).toBeTruthy();

        await act(async () => {
            fireEvent.press(gatewayBtn);
        });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onOpenAccountSettings).toHaveBeenCalledTimes(1);
    });
});
