import type { ThemeColors } from '../theme/tokens';

export interface StatusBarAppearance {
    backgroundColor: string;
    barStyle: 'dark-content' | 'light-content';
}

/**
 * Status bar and top-inset colors. The inset sits on the screen canvas, so it follows the theme; a light bar on a light screen
 * (or the reverse) reads as a rendering fault.
 */
export function statusBarAppearance(theme: ThemeColors): StatusBarAppearance {
    return {
        backgroundColor: theme.canvas,
        barStyle: theme.mode === 'dark_hud' ? 'light-content' : 'dark-content',
    };
}
