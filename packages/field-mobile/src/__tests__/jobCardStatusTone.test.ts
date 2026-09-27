import assert from 'node:assert/strict';
import test from 'node:test';
import { jobStatusTone } from '../components/cards/job-card/job-status-tone.js';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens.js';
import type { DispatchStatus } from '../types/index.js';

const ALL_STATUSES: DispatchStatus[] = [
    'draft',
    'pending_approval',
    'scheduled',
    'dispatched',
    'accepted',
    'en_route',
    'arrived',
    'working',
    'completed',
    'cancelled',
];

for (const theme of [lightThemeColors, darkHudThemeColors]) {
    test(`${theme.mode}: a job awaiting the operator's response is an orange attention state`, () => {
        const tone = jobStatusTone(theme, 'dispatched', true);

        assert.equal(tone.background, theme.warningOrangeLight);
        assert.equal(tone.border, theme.warningOrange);
        assert.equal(tone.text, theme.warningOrangeText);
        assert.equal(tone.icon, 'alert');
    });

    test(`${theme.mode}: jobs in motion are informational cobalt and completed jobs are green`, () => {
        for (const status of ['en_route', 'arrived', 'working'] as const) {
            const tone = jobStatusTone(theme, status, false);

            assert.equal(tone.background, theme.actionCobaltLight, status);
            assert.equal(tone.border, theme.actionCobalt, status);
            assert.equal(tone.text, theme.textPrimary, status);
        }

        const done = jobStatusTone(theme, 'completed', false);

        assert.equal(done.background, theme.successEmeraldLight);
        assert.equal(done.text, theme.successEmeraldText);
        assert.equal(done.icon, 'check-circle');
    });

    test(`${theme.mode}: no job status is drawn in brand gold or decorative hues`, () => {
        const allowed = new Set([
            theme.surfaceHighlight,
            theme.actionCobaltLight,
            theme.successEmeraldLight,
            theme.warningOrangeLight,
            theme.hazardRedLight,
        ]);

        for (const status of ALL_STATUSES) {
            for (const pending of [false, true]) {
                const tone = jobStatusTone(theme, status, pending);

                assert.ok(
                    allowed.has(tone.background),
                    `${status}: ${tone.background} is not a role surface`,
                );
                assert.notEqual(tone.text, theme.brandAmber, status);
                assert.notEqual(tone.border, theme.brandAmber, status);
                assert.ok(tone.icon, `${status} has no icon`);
            }
        }
    });

    test(`${theme.mode}: a cancelled job reads as critical, not neutral`, () => {
        const tone = jobStatusTone(theme, 'cancelled', false);

        assert.equal(tone.background, theme.hazardRedLight);
        assert.equal(tone.text, theme.hazardRedText);
    });
}
