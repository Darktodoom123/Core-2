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
    // Light Mode
    assert.equal(lightThemeColors.mode, 'light');
    assert.equal(lightThemeColors.canvas, '#F1F5F9');
    assert.equal(lightThemeColors.surface, '#FFFFFF');
    assert.equal(lightThemeColors.textPrimary, '#0F172A');
    assert.equal(lightThemeColors.textSecondary, '#64748B');
    assert.equal(lightThemeColors.border, '#E2E8F0');
    assert.equal(lightThemeColors.brandAmber, '#FFBF00');

    // Dark Mode
    assert.equal(darkHudThemeColors.mode, 'dark_hud');
    assert.equal(darkHudThemeColors.canvas, '#090D16');
    assert.equal(darkHudThemeColors.surface, '#1E293B');
    assert.equal(darkHudThemeColors.textPrimary, '#F8FAFC');
    assert.equal(darkHudThemeColors.textSecondary, '#94A3B8');
    assert.equal(darkHudThemeColors.border, '#334155');
    assert.equal(darkHudThemeColors.hudGlowAmber, '#FFBF00');
    assert.equal(darkHudThemeColors.brandAmber, '#FFBF00');
});

const relativeLuminance = (hex: string): number => {
    const channels = [1, 3, 5].map((start) => {
        const value = parseInt(hex.slice(start, start + 2), 16) / 255;

        return value <= 0.03928
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (foreground: string, background: string): number => {
    const [lighter, darker] = [
        relativeLuminance(foreground),
        relativeLuminance(background),
    ].sort((a, b) => b - a);

    return (lighter + 0.05) / (darker + 0.05);
};

test('Warning tokens match the light nativeStyles warning family', () => {
    // Same values as colors.warning / warningLight / warningDark in
    // components/nativeStyles.ts, so migrating a screen is visually identical.
    assert.equal(lightThemeColors.warningOrange, '#EA580C');
    assert.equal(lightThemeColors.warningOrangeLight, '#FFF7ED');
    assert.equal(lightThemeColors.warningOrangeText, '#9A3412');
});

test('Status text tokens match the light nativeStyles ink values', () => {
    // Same values as colors.primaryDark / greenDark / redDark in
    // components/nativeStyles.ts.
    assert.equal(lightThemeColors.brandAmberText, '#806000');
    assert.equal(lightThemeColors.successEmeraldText, '#047857');
    assert.equal(lightThemeColors.hazardRedText, '#B91C1C');
});

test('Status text tokens meet WCAG AA on their soft surfaces in both modes', () => {
    for (const theme of [lightThemeColors, darkHudThemeColors]) {
        const pairs: Array<[string, string, string]> = [
            ['brand', theme.brandAmberText, theme.brandAmberLight],
            ['success', theme.successEmeraldText, theme.successEmeraldLight],
            ['hazard', theme.hazardRedText, theme.hazardRedLight],
            ['warning', theme.warningOrangeText, theme.warningOrangeLight],
        ];

        for (const [role, text, softSurface] of pairs) {
            assert.match(text, /^#[0-9A-F]{6}$/);
            assert.ok(
                contrastRatio(text, softSurface) >= 4.5,
                `${theme.mode}: ${role} text on ${role} surface`,
            );
            assert.ok(
                contrastRatio(text, theme.surface) >= 4.5,
                `${theme.mode}: ${role} text on surface`,
            );
        }
    }
});

test('Warning tokens stay distinct from brand gold and meet WCAG AA in both modes', () => {
    for (const theme of [lightThemeColors, darkHudThemeColors]) {
        const warningTokens = [
            theme.warningOrange,
            theme.warningOrangeLight,
            theme.warningOrangeText,
        ];

        for (const token of warningTokens) {
            assert.match(token, /^#[0-9A-F]{6}$/);
            assert.notEqual(token, theme.brandAmber);
            assert.notEqual(token, theme.hudGlowAmber);
        }

        // Warning text on its own surface and on the default panel surface.
        assert.ok(
            contrastRatio(theme.warningOrangeText, theme.warningOrangeLight) >=
                4.5,
            `${theme.mode}: warning text on warning surface`,
        );
        assert.ok(
            contrastRatio(theme.warningOrangeText, theme.surface) >= 4.5,
            `${theme.mode}: warning text on surface`,
        );
        // Icons and borders are non-text UI and need 3:1.
        assert.ok(
            contrastRatio(theme.warningOrange, theme.surface) >= 3,
            `${theme.mode}: warning icon on surface`,
        );
    }
});

test('Duty category tokens are distinct from action and state colors and readable in both modes', () => {
    for (const theme of [lightThemeColors, darkHudThemeColors]) {
        const duty = [theme.dutyOnDuty, theme.dutyDriving, theme.dutyStandby];
        const reserved = [
            theme.brandAmber,
            theme.warningOrange,
            theme.hazardRed,
            theme.successEmerald,
        ];

        assert.equal(
            new Set(duty).size,
            3,
            `${theme.mode}: duty colors repeat`,
        );

        for (const color of duty) {
            assert.ok(
                !reserved.includes(color),
                `${theme.mode}: ${color} reuses an action or state color`,
            );
            assert.ok(
                contrastRatio(color, theme.surface) >= 3,
                `${theme.mode}: ${color} below 3:1 on surface`,
            );
            assert.ok(
                contrastRatio(theme.textInverse, color) >= 4.5,
                `${theme.mode}: text on ${color} below 4.5:1`,
            );
        }
    }
});
