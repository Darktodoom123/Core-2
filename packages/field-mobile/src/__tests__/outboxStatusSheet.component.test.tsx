import {
    act,
    cleanup,
    fireEvent,
    render,
} from '@testing-library/react-native/pure';
import React from 'react';
import { FieldHeader } from '../components/layout/field-header';
import { OutboxStatusSheet } from '../components/sheets/OutboxStatusSheet';
import { ThemeProvider } from '../theme';
import type { OutboxCommand } from '../types/index';

const sampleCommands: OutboxCommand[] = [
    {
        id: 'cmd-failed-net',
        actorId: 101,
        payloadHash: 'hash-1',
        type: 'submit_dvir',
        payload: {
            inspection_type: 'pre_trip',
            asset_code: 'CRN-501',
            has_defects: false,
            photos: ['p1.jpg', 'p2.jpg'],
        },
        createdAt: '2026-09-20T08:00:00Z',
        updatedAt: '2026-09-20T08:01:00Z',
        attempts: 2,
        state: 'failed',
        error: {
            code: 'GATEWAY_TIMEOUT',
            message: 'Server connection timed out after 15s.',
            retryable: true,
        },
    },
    {
        id: 'cmd-conflict-job',
        actorId: 101,
        payloadHash: 'hash-2',
        type: 'transition_status',
        jobId: 202,
        expectedVersion: 2,
        payload: { job_id: 202, status: 'in_transit' },
        createdAt: '2026-09-20T08:05:00Z',
        updatedAt: '2026-09-20T08:05:30Z',
        attempts: 1,
        state: 'conflict',
        error: {
            code: 'stale_version',
            message: 'Conflict: Dispatch job was updated to version 3.',
            retryable: false,
            currentVersion: 3,
        },
    },
    {
        id: 'cmd-auth-err',
        actorId: 101,
        payloadHash: 'hash-3',
        type: 'report_delay',
        jobId: 202,
        payload: { delay_stage: 'en_route', reason: 'Heavy traffic' },
        createdAt: '2026-09-20T08:10:00Z',
        updatedAt: '2026-09-20T08:10:00Z',
        attempts: 1,
        state: 'failed',
        error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Session expired (401). Please re-authenticate.',
            retryable: true,
        },
    },
    {
        id: 'cmd-legacy-wo',
        actorId: 101,
        payloadHash: 'hash-4',
        type: 'release_maintenance_work_order',
        payload: { maintenance_work_order_id: 88 },
        createdAt: '2026-09-20T07:30:00Z',
        updatedAt: '2026-09-20T07:30:00Z',
        attempts: 1,
        state: 'failed',
        error: {
            code: 'LEGACY_RELEASE_DISALLOWED',
            message:
                'Offline work order release commands are deprecated and cannot be replayed.',
            retryable: false,
        },
    },
    {
        id: 'cmd-waiting-job',
        actorId: 101,
        payloadHash: 'hash-5',
        type: 'submit_job_report',
        jobId: 202,
        payload: { work_summary: 'Completed crane setup at pier 7.' },
        createdAt: '2026-09-20T08:15:00Z',
        updatedAt: '2026-09-20T08:15:00Z',
        attempts: 0,
        state: 'queued',
    },
    {
        id: 'cmd-gps-ping',
        actorId: 101,
        payloadHash: 'hash-6',
        type: 'share_location',
        payload: { latitude: 14.5995, longitude: 120.9842 },
        createdAt: '2026-09-20T08:16:00Z',
        updatedAt: '2026-09-20T08:16:00Z',
        attempts: 0,
        state: 'queued',
    },
];

describe('OutboxStatusSheet & FieldHeader Integration Component Tests', () => {
    afterEach(() => {
        cleanup();
    });

    it('opens outbox sheet when sync pill is pressed on FieldHeader', async () => {
        const onOpenSyncSheet = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <FieldHeader
                    isOnline={true}
                    notificationCount={0}
                    onOpenNotifications={jest.fn()}
                    onOpenProfile={jest.fn()}
                    onOpenSyncSheet={onOpenSyncSheet}
                    profileOpen={false}
                    syncStatusLabel="4 need attention"
                    syncStatusMessage="Tap to review outbox"
                    syncTone="attention"
                    userName="Jane Operator"
                    userRole="Crane Specialist"
                />
            </ThemeProvider>,
        );

        const pill = view.getByTestId('sync-pill-pressable');
        expect(pill).toBeTruthy();

        await act(async () => {
            fireEvent.press(pill);
        });

        expect(onOpenSyncSheet).toHaveBeenCalledTimes(1);
    });

    it('renders overview card, counts chips, and itemized cards in OutboxStatusSheet', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    visible={true}
                />
            </ThemeProvider>,
        );

        expect(view.getByTestId('outbox-status-sheet')).toBeTruthy();
        expect(view.getByTestId('outbox-overview-card')).toBeTruthy();
        expect(view.getByTestId('outbox-sheet-guidance')).toBeTruthy();

        // Check that item cards render
        expect(view.getByTestId('outbox-item-cmd-failed-net')).toBeTruthy();
        expect(view.getByTestId('outbox-item-cmd-conflict-job')).toBeTruthy();
        expect(view.getByTestId('outbox-item-cmd-auth-err')).toBeTruthy();
        expect(view.getByTestId('outbox-item-cmd-legacy-wo')).toBeTruthy();
        expect(view.getByTestId('outbox-item-cmd-waiting-job')).toBeTruthy();

        // Check telemetry summary card
        expect(view.getByTestId('outbox-telemetry-card')).toBeTruthy();
    });

    it('filters commands via category tabs (Attention, Queued, Synced)', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    visible={true}
                />
            </ThemeProvider>,
        );

        // Filter to Attention only
        const attentionTab = view.getByTestId('outbox-filter-attention');
        await act(async () => {
            fireEvent.press(attentionTab);
        });

        // Attention items should be visible
        expect(view.getByTestId('outbox-item-cmd-failed-net')).toBeTruthy();
        expect(view.getByTestId('outbox-item-cmd-conflict-job')).toBeTruthy();

        // Queued item should NOT be in the DOM
        expect(view.queryByTestId('outbox-item-cmd-waiting-job')).toBeNull();

        // Filter to Queued only
        const queuedTab = view.getByTestId('outbox-filter-waiting');
        await act(async () => {
            fireEvent.press(queuedTab);
        });

        // Queued item should now be visible
        expect(view.getByTestId('outbox-item-cmd-waiting-job')).toBeTruthy();
        // Failed item should be hidden
        expect(view.queryByTestId('outbox-item-cmd-failed-net')).toBeNull();
    });

    it('triggers onRetryCommand when retry button is pressed on retryable failure', async () => {
        const onRetry = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    onRetryCommand={onRetry}
                    visible={true}
                />
            </ThemeProvider>,
        );

        const retryBtn = view.getByTestId('outbox-retry-cmd-failed-net');
        expect(retryBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(retryBtn);
        });

        expect(onRetry).toHaveBeenCalledWith('cmd-failed-net');
    });

    it('renders conflict reconciliation buttons and invokes accept server / retry version callbacks', async () => {
        const onAcceptServer = jest.fn();
        const onRetryVersion = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onAcceptServerState={onAcceptServer}
                    onClose={jest.fn()}
                    onRetryNewVersion={onRetryVersion}
                    visible={true}
                />
            </ThemeProvider>,
        );

        const acceptBtn = view.getByTestId(
            'outbox-accept-server-cmd-conflict-job',
        );
        expect(acceptBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(acceptBtn);
        });

        expect(onAcceptServer).toHaveBeenCalledWith('cmd-conflict-job');

        const retryVersionBtn = view.getByTestId(
            'outbox-retry-version-cmd-conflict-job',
        );
        expect(retryVersionBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(retryVersionBtn);
        });

        expect(onRetryVersion).toHaveBeenCalledWith('cmd-conflict-job', 3);
    });

    it('renders sign-in button on 401 error and invokes onSignIn callback', async () => {
        const onSignIn = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    onSignIn={onSignIn}
                    visible={true}
                />
            </ThemeProvider>,
        );

        const signInBtn = view.getByTestId('outbox-signin-cmd-auth-err');
        expect(signInBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(signInBtn);
        });

        expect(onSignIn).toHaveBeenCalledTimes(1);
    });

    it('enforces quarantine on legacy maintenance release: displays non-replayable notice and no retry button', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    onRetryCommand={jest.fn()}
                    visible={true}
                />
            </ThemeProvider>,
        );

        const legacyCard = view.getByTestId('outbox-item-cmd-legacy-wo');
        expect(legacyCard).toBeTruthy();

        // Should display quarantined badge
        expect(view.getByText('Quarantined (cannot replay)')).toBeTruthy();

        // Must NOT have a retry button
        expect(view.queryByTestId('outbox-retry-cmd-legacy-wo')).toBeNull();

        // But should allow discard to clear stale invalid data
        expect(view.getByTestId('outbox-discard-cmd-legacy-wo')).toBeTruthy();
    });

    it('intercepts discard action with safety confirmation dialog and cancels or confirms', async () => {
        const onDiscard = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    onDiscardCommand={onDiscard}
                    visible={true}
                />
            </ThemeProvider>,
        );

        const discardBtn = view.getByTestId('outbox-discard-cmd-failed-net');
        expect(discardBtn).toBeTruthy();

        // Press discard -> confirmation dialog should open
        await act(async () => {
            fireEvent.press(discardBtn);
        });

        expect(await view.findByTestId('discard-confirm-dialog')).toBeTruthy();
        expect(await view.findByText('Discard Unsynced Action?')).toBeTruthy();

        // Press cancel -> should close dialog without discarding
        const cancelBtn = view.getByTestId('cancel-discard-btn');
        await act(async () => {
            fireEvent.press(cancelBtn);
        });

        expect(view.queryByTestId('discard-confirm-dialog')).toBeNull();
        expect(onDiscard).not.toHaveBeenCalled();

        // Press discard again and confirm
        await act(async () => {
            fireEvent.press(discardBtn);
        });

        const confirmBtn = view.getByTestId('confirm-discard-btn');
        await act(async () => {
            fireEvent.press(confirmBtn);
        });

        expect(onDiscard).toHaveBeenCalledWith('cmd-failed-net');
    });

    it('displays empty state when all actions are synchronized', async () => {
        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={[]}
                    isOnline={true}
                    onClose={jest.fn()}
                    visible={true}
                />
            </ThemeProvider>,
        );

        expect(view.getByTestId('outbox-empty-state')).toBeTruthy();
        expect(view.getByText('Outbox is clear')).toBeTruthy();
    });

    it('invokes onSyncNow when Sync Now button is pressed', async () => {
        const onSyncNow = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    onSyncNow={onSyncNow}
                    visible={true}
                />
            </ThemeProvider>,
        );

        const syncNowBtn = view.getByTestId('sheet-sync-now-btn');
        expect(syncNowBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(syncNowBtn);
        });

        expect(onSyncNow).toHaveBeenCalledTimes(1);
    });

    it('invokes onClose when close button or dismiss is pressed', async () => {
        const onClose = jest.fn();

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={sampleCommands}
                    isOnline={true}
                    onClose={onClose}
                    visible={true}
                />
            </ThemeProvider>,
        );

        const closeBtn = view.getByTestId('outbox-sheet-close-btn');
        await act(async () => {
            fireEvent.press(closeBtn);
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows context-aware empty state text when active items exist but current tab has none', async () => {
        // Outbox with only a queued item (no attention items)
        const queuedOnlyCommands: OutboxCommand[] = [
            {
                id: 'cmd-only-queued',
                actorId: 101,
                payloadHash: 'hash-q',
                type: 'submit_job_report',
                jobId: 202,
                payload: { work_summary: 'Report pending' },
                createdAt: '2026-09-20T08:00:00Z',
                updatedAt: '2026-09-20T08:00:00Z',
                attempts: 0,
                state: 'queued',
            },
        ];

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={queuedOnlyCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    visible={true}
                />
            </ThemeProvider>,
        );

        // Switch to Attention tab
        const attentionTab = view.getByTestId('outbox-filter-attention');
        await act(async () => {
            fireEvent.press(attentionTab);
        });

        expect(view.getByTestId('outbox-empty-state')).toBeTruthy();
        expect(view.getByText('No actions require attention')).toBeTruthy();
        expect(
            view.getByText(
                'All queued actions are healthy or syncing normally.',
            ),
        ).toBeTruthy();
    });

    it('hides Sync Now button when only quarantined non-retryable items exist in outbox', async () => {
        const quarantinedOnlyCommands: OutboxCommand[] = [
            {
                id: 'cmd-legacy-only',
                actorId: 101,
                payloadHash: 'hash-leg',
                type: 'release_maintenance_work_order',
                payload: { maintenance_work_order_id: 88 },
                createdAt: '2026-09-20T07:30:00Z',
                updatedAt: '2026-09-20T07:30:00Z',
                attempts: 1,
                state: 'failed',
                error: {
                    code: 'LEGACY_RELEASE_DISALLOWED',
                    message:
                        'Offline work order release commands are deprecated and cannot be replayed.',
                    retryable: false,
                },
            },
        ];

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={quarantinedOnlyCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    onSyncNow={jest.fn()}
                    visible={true}
                />
            </ThemeProvider>,
        );

        // Sync Now button must NOT be rendered because there are no queued items and no retryable items
        expect(view.queryByTestId('sheet-sync-now-btn')).toBeNull();
    });

    it('displays server cancellation warning when item.isCancelledOnServer is true and does not render Retry v{version}', async () => {
        const cancelledConflictCommands: OutboxCommand[] = [
            {
                id: 'cmd-conflict-cancelled',
                actorId: 101,
                payloadHash: 'hash-c-canc',
                type: 'transition_status',
                jobId: 202,
                expectedVersion: 2,
                payload: { job_id: 202, status: 'in_transit' },
                createdAt: '2026-09-20T08:05:00Z',
                updatedAt: '2026-09-20T08:05:30Z',
                attempts: 1,
                state: 'conflict',
                error: {
                    code: 'stale_version',
                    message:
                        'Conflict: Dispatch job was cancelled on the server.',
                    retryable: false,
                    currentVersion: 3,
                    serverSnapshot: {
                        id: 202,
                        reference: 'JOB-202',
                        version: 3,
                        status: { value: 'cancelled', label: 'Cancelled' },
                    } as any,
                },
            },
        ];

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={cancelledConflictCommands}
                    isOnline={true}
                    onAcceptServerState={jest.fn()}
                    onClose={jest.fn()}
                    onRetryNewVersion={jest.fn()}
                    visible={true}
                />
            </ThemeProvider>,
        );

        // Warning notice must be displayed
        expect(
            view.getByTestId('server-cancelled-notice-cmd-conflict-cancelled'),
        ).toBeTruthy();
        expect(
            view.getByText(
                'Job was cancelled on the server. This action cannot be retried.',
            ),
        ).toBeTruthy();

        // Accept Server button should be available
        expect(
            view.getByTestId('outbox-accept-server-cmd-conflict-cancelled'),
        ).toBeTruthy();

        // Retry version button must NOT be rendered because the job is cancelled
        expect(
            view.queryByTestId('outbox-retry-version-cmd-conflict-cancelled'),
        ).toBeNull();
    });

    it('displays missing attachment notice and invokes onRecaptureAttachment when recapture button is pressed', async () => {
        const onRecapture = jest.fn();
        const missingPhotoCommands: OutboxCommand[] = [
            {
                id: 'cmd-missing-photo',
                actorId: 101,
                payloadHash: 'hash-missing',
                type: 'submit_dvir',
                payload: {
                    inspection_type: 'pre_trip',
                    asset_code: 'CRN-501',
                    has_defects: false,
                    photos: ['file:///missing/dvir-front.jpg'],
                },
                createdAt: '2026-09-20T08:00:00Z',
                updatedAt: '2026-09-20T08:01:00Z',
                attempts: 1,
                state: 'failed',
                error: {
                    code: 'MISSING_ATTACHMENTS',
                    message:
                        'Required attachment file is missing from device storage.',
                    retryable: false,
                    missingAttachmentUri: 'file:///missing/dvir-front.jpg',
                },
            },
        ];

        const view = await render(
            <ThemeProvider initialMode="light">
                <OutboxStatusSheet
                    commands={missingPhotoCommands}
                    isOnline={true}
                    onClose={jest.fn()}
                    onRecaptureAttachment={onRecapture}
                    visible={true}
                />
            </ThemeProvider>,
        );

        expect(
            view.getByTestId('missing-attachment-notice-cmd-missing-photo'),
        ).toBeTruthy();
        expect(
            view.getByText('Missing file: file:///missing/dvir-front.jpg'),
        ).toBeTruthy();

        const recaptureBtn = view.getByTestId(
            'outbox-recapture-cmd-missing-photo',
        );
        expect(recaptureBtn).toBeTruthy();

        await act(async () => {
            fireEvent.press(recaptureBtn);
        });

        expect(onRecapture).toHaveBeenCalledWith(
            'cmd-missing-photo',
            'file:///missing/dvir-front.jpg',
        );
    });
});
