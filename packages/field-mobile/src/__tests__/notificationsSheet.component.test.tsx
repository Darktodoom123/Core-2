import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import { FieldHeader } from '../components/layout/field-header';
import { NotificationsSheet } from '../components/sheets/notifications-sheet';
import { ThemeProvider } from '../theme';
import type { DispatchJob, OutboxCommand } from '../types/index';

const mockFailedCommands: OutboxCommand[] = [
    {
        id: 'cmd-1',
        actorId: 1,
        payloadHash: 'hash-1',
        type: 'transition_status',
        payload: { job_id: 101, status: 'arrived' },
        createdAt: '2026-09-04T10:00:00Z',
        updatedAt: '2026-09-04T10:00:00Z',
        attempts: 3,
        state: 'failed',
        error: {
            message: 'Network timeout during status update.',
            retryable: true,
        },
    },
    {
        id: 'cmd-2',
        actorId: 1,
        payloadHash: 'hash-2',
        type: 'submit_job_report',
        payload: { dispatch_job_id: 101, work_summary: 'Shift done' },
        createdAt: '2026-09-04T10:05:00Z',
        updatedAt: '2026-09-04T10:05:00Z',
        attempts: 5,
        state: 'failed',
        error: {
            message: 'Server rejected payload validation.',
            retryable: false,
        },
    },
    {
        id: 'cmd-sos',
        actorId: 1,
        payloadHash: 'hash-sos',
        type: 'activate_sos',
        payload: { latitude: 14.5, longitude: 121.0 },
        createdAt: '2026-09-04T10:10:00Z',
        updatedAt: '2026-09-04T10:10:00Z',
        attempts: 5,
        state: 'failed',
        error: {
            message: 'Dispatch gateway unreachable.',
            retryable: true,
        },
    },
];

const mockPendingJobs: DispatchJob[] = [
    {
        id: 201,
        reference: 'DISP-8821',
        client: 'Metro Infrastructure Group',
        title: 'Pier 4 Heavy Machinery Lift',
        status: { value: 'dispatched', label: 'Dispatched' },
        priority: { value: 'emergency', label: 'Emergency' },
        site: 'South Harbor Gate 3',
        version: 1,
        capabilities: {
            can_respond: true,
            can_update_status: true,
            can_share_location: true,
        },
        my_assignment: {
            id: 501,
            response_status: 'pending',
            response_status_label: 'Pending',
        },
    },
];

describe('Field Mobile Notification Bell & Sheet UI/UX', () => {
    afterEach(() => {
        cleanup();
    });

    describe('FieldHeader Notification Bell Button', () => {
        it('is always visible in the header even when notificationCount is 0', async () => {
            const onOpenNotifications = jest.fn();

            const view = await render(
                <ThemeProvider initialMode="light">
                    <FieldHeader
                        notificationCount={0}
                        onOpenNotifications={onOpenNotifications}
                        onOpenProfile={jest.fn()}
                        profileOpen={false}
                        syncStatusLabel="Synced"
                        syncStatusMessage="Just now"
                        syncTone="online"
                        userName="Alex Rivera"
                        userRole="Crane Operator"
                    />
                </ThemeProvider>,
            );

            const bellBtn = view.getByTestId('notification-button');
            expect(bellBtn).toBeTruthy();
            expect(bellBtn.props.accessibilityLabel).toBe(
                'Notifications: No unread alerts',
            );

            // Badge should not be rendered when count is 0
            expect(view.queryByText('0')).toBeNull();

            // Pressing calls onOpenNotifications
            await act(async () => {
                fireEvent.press(bellBtn);
            });
            expect(onOpenNotifications).toHaveBeenCalledTimes(1);
        });

        it('displays high-contrast unread count badge when notificationCount > 0', async () => {
            const view = await render(
                <ThemeProvider initialMode="light">
                    <FieldHeader
                        notificationCount={4}
                        onOpenNotifications={jest.fn()}
                        onOpenProfile={jest.fn()}
                        profileOpen={false}
                        syncStatusLabel="Needs review"
                        syncStatusMessage="Actions failed"
                        syncTone="attention"
                        userName="Alex Rivera"
                        userRole="Crane Operator"
                    />
                </ThemeProvider>,
            );

            const bellBtn = view.getByTestId('notification-button');
            expect(bellBtn.props.accessibilityLabel).toBe(
                'Notifications: 4 unread items',
            );
            expect(view.getByText('4')).toBeTruthy();
        });

        it('displays "9+" for notification counts exceeding 9', async () => {
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <FieldHeader
                        notificationCount={15}
                        onOpenNotifications={jest.fn()}
                        onOpenProfile={jest.fn()}
                        profileOpen={false}
                        syncStatusLabel="Needs review"
                        syncStatusMessage="Multiple alerts"
                        syncTone="attention"
                        userName="Alex Rivera"
                        userRole="Crane Operator"
                    />
                </ThemeProvider>,
            );

            expect(view.getByText('9+')).toBeTruthy();
        });

        it('displays "online" and not "offline" when connected to internet even if actions need attention', async () => {
            const view = await render(
                <ThemeProvider initialMode="light">
                    <FieldHeader
                        isOnline={true}
                        notificationCount={1}
                        onOpenNotifications={jest.fn()}
                        onOpenProfile={jest.fn()}
                        profileOpen={false}
                        syncStatusLabel="Needs review"
                        syncStatusMessage="Action needed"
                        syncTone="attention"
                        userName="Alex Rivera"
                        userRole="Crane Operator"
                    />
                </ThemeProvider>,
            );

            expect(view.getByText('online')).toBeTruthy();
            expect(view.queryByText('offline')).toBeNull();
            expect(view.queryByText('needs review')).toBeNull();
        });

        it('displays "offline" when disconnected from internet', async () => {
            const view = await render(
                <ThemeProvider initialMode="light">
                    <FieldHeader
                        isOnline={false}
                        notificationCount={0}
                        onOpenNotifications={jest.fn()}
                        onOpenProfile={jest.fn()}
                        profileOpen={false}
                        syncStatusLabel="Disconnected"
                        syncStatusMessage="Reconnect to sync"
                        syncTone="offline"
                        userName="Alex Rivera"
                        userRole="Crane Operator"
                    />
                </ThemeProvider>,
            );

            expect(view.getByText('offline')).toBeTruthy();
            expect(view.queryByText('online')).toBeNull();
        });

        it('displays "online" when syncTone is online', async () => {
            const view = await render(
                <ThemeProvider initialMode="light">
                    <FieldHeader
                        notificationCount={0}
                        onOpenNotifications={jest.fn()}
                        onOpenProfile={jest.fn()}
                        profileOpen={false}
                        syncStatusLabel="Synced"
                        syncStatusMessage="Just now"
                        syncTone="online"
                        userName="Alex Rivera"
                        userRole="Crane Operator"
                    />
                </ThemeProvider>,
            );

            expect(view.getByText('online')).toBeTruthy();
        });
    });

    describe('NotificationsSheet Drawer & Gestures', () => {
        it('renders sheet header, action count badge, close button, and dismiss scrim', async () => {
            const onClose = jest.fn();

            const view = await render(
                <ThemeProvider initialMode="light">
                    <NotificationsSheet
                        failedCount={2}
                        onClose={onClose}
                        visible={true}
                    />
                </ThemeProvider>,
            );

            expect(view.getByTestId('notifications-sheet')).toBeTruthy();
            expect(view.getByText('Notifications & Alerts')).toBeTruthy();
            expect(view.getByText('2 Actions')).toBeTruthy();

            const closeBtn = view.getByTestId('notifications-sheet-close');
            await act(async () => {
                fireEvent.press(closeBtn);
            });
            expect(onClose).toHaveBeenCalledTimes(1);

            const scrim = view.getByTestId('notifications-sheet-dismiss');
            await act(async () => {
                fireEvent.press(scrim);
            });
            expect(onClose).toHaveBeenCalledTimes(2);
        });

        it('supports segmented filter tabs for All, Alerts, Dispatches, and Outbox', async () => {
            const view = await render(
                <ThemeProvider initialMode="light">
                    <NotificationsSheet
                        failedCommands={mockFailedCommands}
                        failedCount={2}
                        isOnline={true}
                        onClose={jest.fn()}
                        pendingJobs={mockPendingJobs}
                        pendingResponseCount={1}
                        queuedCount={1}
                        visible={true}
                    />
                </ThemeProvider>,
            );

            const tabAll = view.getByTestId('notification-tab-all');
            const tabAlerts = view.getByTestId('notification-tab-alerts');
            const tabDispatches = view.getByTestId(
                'notification-tab-dispatches',
            );
            const tabOutbox = view.getByTestId('notification-tab-outbox');

            expect(tabAll).toBeTruthy();
            expect(tabAlerts).toBeTruthy();
            expect(tabDispatches).toBeTruthy();
            expect(tabOutbox).toBeTruthy();

            // All tab shows alerts, critical SOS, and dispatches
            expect(view.getByText('Status update failed')).toBeTruthy();
            expect(
                view.getByText('Emergency SOS alert failed to send'),
            ).toBeTruthy();
            expect(
                view.getByText('DISP-8821 · Pier 4 Heavy Machinery Lift'),
            ).toBeTruthy();

            // Switch to Alerts tab
            await act(async () => {
                fireEvent.press(tabAlerts);
            });
            expect(view.getByText('Status update failed')).toBeTruthy();
            expect(
                view.getByText('Emergency SOS alert failed to send'),
            ).toBeTruthy();
            expect(
                view.queryByText('DISP-8821 · Pier 4 Heavy Machinery Lift'),
            ).toBeNull();

            // Switch to Dispatches tab
            await act(async () => {
                fireEvent.press(tabDispatches);
            });
            expect(
                view.getByText('DISP-8821 · Pier 4 Heavy Machinery Lift'),
            ).toBeTruthy();
            expect(view.queryByText('Status update failed')).toBeNull();
            expect(
                view.queryByText('Emergency SOS alert failed to send'),
            ).toBeNull();

            // Switch to Outbox tab
            await act(async () => {
                fireEvent.press(tabOutbox);
            });
            expect(view.getByText('System Status & Outbox')).toBeTruthy();
            expect(view.getByText(/1 action queued for upload/)).toBeTruthy();
        });
    });

    describe('Interactive Actions & Deduplication', () => {
        it('allows retrying and discarding failed outbox commands', async () => {
            const onRetryCommand = jest.fn();
            const onDiscardCommand = jest.fn();

            const view = await render(
                <ThemeProvider initialMode="light">
                    <NotificationsSheet
                        failedCommands={mockFailedCommands}
                        failedCount={2}
                        onClose={jest.fn()}
                        onDiscardCommand={onDiscardCommand}
                        onRetryCommand={onRetryCommand}
                        visible={true}
                    />
                </ThemeProvider>,
            );

            // Retry retryable command
            const retryBtn = view.getByTestId('notification-retry-btn-cmd-1');
            await act(async () => {
                fireEvent.press(retryBtn);
            });
            expect(onRetryCommand).toHaveBeenCalledWith('cmd-1');

            // Discard command
            const discardBtn = view.getByTestId(
                'notification-discard-btn-cmd-2',
            );
            await act(async () => {
                fireEvent.press(discardBtn);
            });
            expect(onDiscardCommand).toHaveBeenCalledWith('cmd-2');
        });

        it('allows accepting and declining pending dispatch invitations', async () => {
            const onAcceptJob = jest.fn();
            const onDeclineJob = jest.fn();

            const view = await render(
                <ThemeProvider initialMode="light">
                    <NotificationsSheet
                        onAcceptJob={onAcceptJob}
                        onClose={jest.fn()}
                        onDeclineJob={onDeclineJob}
                        pendingJobs={mockPendingJobs}
                        pendingResponseCount={1}
                        visible={true}
                    />
                </ThemeProvider>,
            );

            const acceptBtn = view.getByTestId('notification-accept-job-201');
            await act(async () => {
                fireEvent.press(acceptBtn);
            });
            expect(onAcceptJob).toHaveBeenCalledWith(201);

            const declineBtn = view.getByTestId('notification-decline-job-201');
            await act(async () => {
                fireEvent.press(declineBtn);
            });
            expect(onDeclineJob).toHaveBeenCalledWith(201);
        });

        it('renders reassuring empty state when all notifications are clear', async () => {
            const view = await render(
                <ThemeProvider initialMode="light">
                    <NotificationsSheet
                        failedCount={0}
                        onClose={jest.fn()}
                        queuedCount={0}
                        visible={true}
                    />
                </ThemeProvider>,
            );

            expect(view.getByTestId('notification-empty-state')).toBeTruthy();
            expect(view.getByText("You're all caught up!")).toBeTruthy();
        });

        it('renders contextual empty state when switching to an empty tab', async () => {
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <NotificationsSheet
                        failedCount={0}
                        onClose={jest.fn()}
                        pendingJobs={[]}
                        queuedCount={0}
                        visible={true}
                    />
                </ThemeProvider>,
            );

            const tabDispatches = view.getByTestId(
                'notification-tab-dispatches',
            );
            await act(async () => {
                fireEvent.press(tabDispatches);
            });

            expect(view.getByText('No Pending Dispatches')).toBeTruthy();
        });
    });

    describe('Cockpit HUD Night Mode Compliance', () => {
        it('renders notifications sheet in Cockpit HUD dark theme with high contrast tokens', async () => {
            const view = await render(
                <ThemeProvider initialMode="dark_hud">
                    <NotificationsSheet
                        failedCommands={mockFailedCommands}
                        failedCount={2}
                        isOnline={false}
                        onClose={jest.fn()}
                        pendingJobs={mockPendingJobs}
                        pendingResponseCount={1}
                        queuedCount={2}
                        visible={true}
                    />
                </ThemeProvider>,
            );

            // Verify dark mode elements render cleanly
            expect(view.getByText('Status update failed')).toBeTruthy();
            expect(
                view.getByText('Emergency SOS alert failed to send'),
            ).toBeTruthy();
        });
    });
});
