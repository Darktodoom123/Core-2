import assert from 'node:assert/strict';
import test from 'node:test';
import { statusBarAppearance } from '../navigation/status-bar-appearance.js';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens.js';

test('migrated screens take the status bar from the active theme', () => {
    for (const view of ['main', 'hos', 'dvir', 'inspection'] as const) {
        assert.deepEqual(statusBarAppearance(view, lightThemeColors), {
            backgroundColor: lightThemeColors.canvas,
            barStyle: 'dark-content',
        });
        assert.deepEqual(statusBarAppearance(view, darkHudThemeColors), {
            backgroundColor: darkHudThemeColors.canvas,
            barStyle: 'light-content',
        });
    }
});

test('cockpit screens not yet on theme roles keep a dark status bar', () => {
    for (const view of ['routes'] as const) {
        for (const theme of [lightThemeColors, darkHudThemeColors]) {
            assert.deepEqual(statusBarAppearance(view, theme), {
                backgroundColor: darkHudThemeColors.canvas,
                barStyle: 'light-content',
            });
        }
    }
});
