import assert from 'node:assert/strict';
import test from 'node:test';
import { documentStatusTone } from '../screens/documents/document-status-tone.js';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens.js';

for (const theme of [lightThemeColors, darkHudThemeColors]) {
    test(`${theme.mode}: valid and permanent documents are green`, () => {
        for (const status of ['valid', 'permanent']) {
            const tone = documentStatusTone(theme, status);

            assert.equal(tone.background, theme.successEmeraldLight, status);
            assert.equal(tone.text, theme.successEmeraldText, status);
        }
    });

    test(`${theme.mode}: expiring soon is orange and expired or revoked is red`, () => {
        assert.equal(
            documentStatusTone(theme, 'expiring_soon').text,
            theme.warningOrangeText,
        );

        for (const status of ['expired', 'revoked']) {
            const tone = documentStatusTone(theme, status);

            assert.equal(tone.background, theme.hazardRedLight, status);
            assert.equal(tone.text, theme.hazardRedText, status);
        }
    });

    test(`${theme.mode}: an unknown or missing status is never shown as Valid`, () => {
        for (const input of [undefined, null, '', 'pending_review']) {
            const tone = documentStatusTone(theme, input);

            assert.notEqual(tone.label, 'Valid', String(input));
            assert.notEqual(tone.background, theme.successEmeraldLight);
            assert.equal(tone.background, theme.surfaceHighlight);
        }

        assert.equal(
            documentStatusTone(theme, undefined).label,
            'Status Unknown',
        );
        assert.equal(
            documentStatusTone(theme, {
                value: 'pending_review',
                label: 'Under Review',
            }).label,
            'Under Review',
        );
    });

    test(`${theme.mode}: object statuses resolve by value`, () => {
        const tone = documentStatusTone(theme, {
            value: 'expired',
            label: 'Expired',
        });

        assert.equal(tone.text, theme.hazardRedText);
        assert.ok(tone.detail('2026-01-01').includes('2026-01-01'));
    });
}
