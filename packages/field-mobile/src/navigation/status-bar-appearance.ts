import { darkHudThemeColors } from '../theme/tokens';
import type { ThemeColors } from '../theme/tokens';

export interface StatusBarAppearance {
    backgroundColor: string;
    barStyle: 'dark-content' | 'light-content';
}

// Cockpit screens that still draw their own always-dark palette. Remove a view
// from this list once its screen reads colors from the theme.
const ALWAYS_DARK_VIEWS = new Set(['inspection', 'routes']);

/**
 * Status bar and top-inset colors for the active app view. The inset sits on
 * the screen canvas, so it follows the theme; a light bar on a light screen
 * (or the reverse) reads as a rendering fault.
 */
export function statusBarAppearance(
    view: string,
    theme: ThemeColors,
): StatusBarAppearance {
    const isDark = ALWAYS_DARK_VIEWS.has(view) || theme.mode === 'dark_hud';

    return {
        backgroundColor: ALWAYS_DARK_VIEWS.has(view)
            ? darkHudThemeColors.canvas
            : theme.canvas,
        barStyle: isDark ? 'light-content' : 'dark-content',
    };
}
