import React, { createContext, useContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
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

export const createMachinedStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        screenCanvas: {
            flex: 1,
            backgroundColor: theme.canvas,
        },
        headerBezel: {
            backgroundColor:
                theme.mode === 'dark_hud'
                    ? theme.surfaceElevated
                    : theme.surfaceDark,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        headerTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: '#FFFFFF',
            letterSpacing: 0.2,
        },
        headerSubtitle: {
            fontSize: 13,
            color: '#94A3B8',
            marginTop: 2,
        },
        machinedPanel: {
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 16,
            marginBottom: 14,
        },
        panelTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.textPrimary,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginBottom: 10,
        },
        actionPedalPrimary: {
            minHeight: 52,
            backgroundColor:
                theme.mode === 'dark_hud'
                    ? theme.brandAmber
                    : theme.surfaceDark,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 18,
            borderWidth: 1,
            borderColor:
                theme.mode === 'dark_hud'
                    ? theme.hudGlowAmber
                    : theme.borderStrong,
        },
        actionPedalPrimaryText: {
            color: theme.mode === 'dark_hud' ? '#0F172A' : '#FFFFFF',
            fontSize: 15,
            fontWeight: '800',
            letterSpacing: 0.3,
            textTransform: 'uppercase',
        },
        actionRockerSecondary: {
            minHeight: 48,
            backgroundColor: theme.surfaceElevated,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: theme.borderStrong,
        },
        actionRockerSecondaryText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        telemetryMono: {
            fontFamily: 'monospace',
            fontWeight: '700',
            color: theme.textPrimary,
        },
    });
