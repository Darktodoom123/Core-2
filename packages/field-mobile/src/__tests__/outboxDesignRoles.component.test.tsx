import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { OutboxStatusSheet } from '../components/sheets/OutboxStatusSheet';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { OutboxCommand } from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const base = {
    actorId: 1,
    payloadHash: 'hash',
    createdAt: '2026-09-27T08:00:00Z',
    updatedAt: '2026-09-27T08:01:00Z',
    attempts: 1,
};

const retryableFailure = {
    ...base,
    id: 'cmd-retry',
    type: 'submit_dvir',
    payload: { inspection_type: 'pre_trip', asset_code: 'CRN-1' },
    state: 'failed',
    error: { code: 'GATEWAY_TIMEOUT', message: 'Timed out.', retryable: true },
} as OutboxCommand;

const rejected = {
    ...base,
    id: 'cmd-rejected',
    type: 'start_hos_shift',
    payload: {},
    state: 'failed',
    error: { code: 'VALIDATION', message: 'Rejected.', retryable: false },
} as OutboxCommand;

const waiting = {
    ...base,
    id: 'cmd-waiting',
    type: 'submit_job_report',
    jobId: 5,
    payload: { work_summary: 'Done' },
    attempts: 0,
    state: 'queued',
} as OutboxCommand;

type View = Awaited<ReturnType<typeof render>>;

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const textColor = (view: View, text: string | RegExp) =>
    StyleSheet.flatten(view.getByText(text).props.style).color;

const renderSheet = (mode: ThemeMode, commands: OutboxCommand[]) =>
    render(
        <ThemeProvider initialMode={mode}>
            <OutboxStatusSheet
                commands={commands}
                isOnline
                onClose={jest.fn()}
                onDiscardCommand={jest.fn()}
                onRetryCommand={jest.fn()}
                onSyncNow={jest.fn()}
                visible
            />
        </ThemeProvider>,
    );

describe.each(MODES)(
    'Outbox sheet design roles (%s)',
    (mode, theme: ThemeColors) => {
        it('uses plain words and one set of counts', async () => {
            const view = await renderSheet(mode, [retryableFailure, waiting]);

            expect(view.getByText('Saved actions')).toBeTruthy();
            expect(view.queryByText('Outbox Synchronization')).toBeNull();
            // Counts live on the filter tabs only, not in a second chip row.
            expect(view.queryByText(/^Waiting: /)).toBeNull();
            expect(view.queryByText(/^Needs Attention: /)).toBeNull();
            expect(view.queryByText(/Eligible/)).toBeNull();
        });

        it('draws the summary on a neutral surface, orange for retryable problems and red for rejected ones', async () => {
            const calm = await renderSheet(mode, [waiting]);

            expect(flat(calm, 'outbox-overview-card').backgroundColor).toBe(
                theme.surface,
            );

            const attention = await renderSheet(mode, [retryableFailure]);

            expect(flat(attention, 'outbox-overview-card').borderColor).toBe(
                theme.warningOrange,
            );

            const critical = await renderSheet(mode, [rejected]);

            expect(flat(critical, 'outbox-overview-card').borderColor).toBe(
                theme.hazardRed,
            );
        });

        it('tones each item by what the operator must do', async () => {
            const view = await renderSheet(mode, [
                retryableFailure,
                rejected,
                waiting,
            ]);

            expect(flat(view, 'outbox-item-cmd-retry').borderColor).toBe(
                theme.warningOrange,
            );
            expect(flat(view, 'outbox-item-cmd-rejected').borderColor).toBe(
                theme.hazardRed,
            );
            expect(flat(view, 'outbox-item-cmd-waiting').borderColor).toBe(
                theme.border,
            );
            // Hours of Service commands have a real name.
            expect(view.getByText('Start shift')).toBeTruthy();
            // A waiting item is not claimed to be in progress.
            expect(view.queryByText(/in progress/)).toBeNull();
            expect(view.getByText(/ready to send/)).toBeTruthy();
        });

        it('keeps gold for the one main action and red for discard', async () => {
            const view = await renderSheet(mode, [retryableFailure]);

            expect(flat(view, 'sheet-sync-now-btn').backgroundColor).toBe(
                theme.brandAmber,
            );
            expect(
                flat(view, 'sheet-sync-now-btn').minHeight,
            ).toBeGreaterThanOrEqual(52);
            expect(textColor(view, /^Retry and sync|^Sync now/)).toBe(
                theme.surfaceDark,
            );

            // The summary owns the gold action; a card's Retry is secondary.
            const retry = flat(view, 'outbox-retry-cmd-retry');

            expect(retry.backgroundColor).toBe(theme.surface);
            expect(retry.borderColor).toBe(theme.borderStrong);

            const discard = flat(view, 'outbox-discard-cmd-retry');

            expect(discard.borderColor).toBe(theme.hazardRed);
            expect(discard.minHeight).toBeGreaterThanOrEqual(48);

            await fireEvent.press(view.getByTestId('outbox-discard-cmd-retry'));

            expect(flat(view, 'confirm-discard-btn').backgroundColor).toBe(
                theme.hazardRed,
            );
            expect(
                StyleSheet.flatten(
                    within(view.getByTestId('confirm-discard-btn')).getByText(
                        'Discard',
                    ).props.style,
                ).color,
            ).toBe(theme.textInverse);
        });

        it('marks the selected filter with Signal Gold Soft', async () => {
            const view = await renderSheet(mode, [retryableFailure, waiting]);
            const all = flat(view, 'outbox-filter-all');

            expect(all.backgroundColor).toBe(theme.brandAmberLight);
            expect(all.borderColor).toBe(theme.brandAmber);
            expect(all.minHeight).toBeGreaterThanOrEqual(48);
        });
    },
);
