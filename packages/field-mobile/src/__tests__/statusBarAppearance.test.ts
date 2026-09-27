import assert from 'node:assert/strict';
import test from 'node:test';
import { statusBarAppearance } from '../navigation/status-bar-appearance.js';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens.js';

test('the status bar always follows the active theme', () => {
    assert.deepEqual(statusBarAppearance(lightThemeColors), {
        backgroundColor: lightThemeColors.canvas,
        barStyle: 'dark-content',
    });
    assert.deepEqual(statusBarAppearance(darkHudThemeColors), {
        backgroundColor: darkHudThemeColors.canvas,
        barStyle: 'light-content',
    });
});
