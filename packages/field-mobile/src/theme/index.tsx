import React, { createContext, useContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { lightThemeColors, darkHudThemeColors } from './tokens';
import type { ThemeMode, ThemeColors } from './tokens';

export * from './tokens';

interface ThemeContextValue {
    theme: ThemeColors;
    mode: ThemeMode;
    isDarkHud: boolean;
    setMode: (mode: ThemeMode) => void;
    toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: lightThemeColors,
    mode: 'light',
    isDarkHud: false,
    setMode: () => {},
    toggleMode: () => {},
});

export const ThemeProvider: React.FC<{
    children: ReactNode;
    initialMode?: ThemeMode;
}> = ({ children, initialMode = 'light' }) => {
    const [mode, setMode] = useState<ThemeMode>(initialMode);

    const theme = useMemo(() => {
        return mode === 'dark_hud' ? darkHudThemeColors : lightThemeColors;
    }, [mode]);

    const toggleMode = () => {
        setMode((prev) => (prev === 'light' ? 'dark_hud' : 'light'));
    };

    const value = useMemo(
        () => ({
            theme,
            mode,
            isDarkHud: mode === 'dark_hud',
            setMode,
            toggleMode,
        }),
        [theme, mode],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextValue => {
    return useContext(ThemeContext);
};

/**
 * Memoizes a component's `StyleSheet.create(...)` built from the active theme,
 * so one style set covers light and dark HUD. Define `factory` at module scope
 * so it is stable across renders.
 */
export function useThemedStyles<T>(factory: (theme: ThemeColors) => T): T {
    const { theme } = useTheme();

    return useMemo(() => factory(theme), [factory, theme]);
}
