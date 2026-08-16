import assert from 'node:assert/strict';
import test from 'node:test';
import { lightThemeColors, darkHudThemeColors } from '../theme/tokens.js';
import {
    formatPHP,
    formatPHT,
    formatDurationHoursMins,
    formatStopwatch,
} from '../utils/formatters.js';

test('formatPHP formats amounts in Philippine Peso', () => {
    assert.equal(formatPHP(4500), '₱4,500.00');
    assert.equal(formatPHP(4500, false), '₱4,500');
    assert.equal(formatPHP(42500.5), '₱42,500.50');
    assert.equal(formatPHP(0), '₱0.00');
    assert.equal(formatPHP(null), '₱0.00');
    assert.equal(formatPHP(undefined), '₱0.00');
});

test('formatPHT formats timestamps in Asia/Manila PHT timezone', () => {
    const isoDate = '2026-08-15T16:00:00.000Z'; // 00:00 PHT next day
    const timeFormatted = formatPHT(isoDate, 'time');
    assert.match(timeFormatted, /00:00:00 PHT/);

    const dateFormatted = formatPHT(isoDate, 'date');
    assert.match(dateFormatted, /Aug 16, 2026/);
});

test('formatDurationHoursMins formats total minutes to industrial duration notation', () => {
    assert.equal(formatDurationHoursMins(255), '04h 15m');
    assert.equal(formatDurationHoursMins(87), '01h 27m');
    assert.equal(formatDurationHoursMins(0), '00h 00m');
    assert.equal(formatDurationHoursMins(-5), '00h 00m');
});

test('formatStopwatch formats total seconds to hh:mm:ss', () => {
    assert.equal(formatStopwatch(3665), '01:01:05');
    assert.equal(formatStopwatch(0), '00:00:00');
});

test('Dual-mode theme tokens satisfy contrast and color assignments', () => {
    assert.equal(lightThemeColors.mode, 'light');
    assert.equal(lightThemeColors.canvas, '#F1F5F9');
    assert.equal(lightThemeColors.surface, '#FFFFFF');
    assert.equal(lightThemeColors.textPrimary, '#0F172A');

    assert.equal(darkHudThemeColors.mode, 'dark_hud');
    assert.equal(darkHudThemeColors.canvas, '#090D16');
    assert.equal(darkHudThemeColors.surface, '#0F172A');
    assert.equal(darkHudThemeColors.hudGlowAmber, '#FBBF24');
    assert.equal(darkHudThemeColors.hudGlowEmerald, '#34D399');
});
