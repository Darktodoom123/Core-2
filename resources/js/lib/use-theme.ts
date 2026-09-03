import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'core2-theme-preference';

export function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') {
        return 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

export function applyTheme(theme: Theme): ResolvedTheme {
    if (typeof window === 'undefined') {
        return 'light';
    }

    const resolved: ResolvedTheme =
        theme === 'system' ? getSystemTheme() : theme;
    const root = document.documentElement;

    if (resolved === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
    } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
    }

    return resolved;
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === 'undefined') {
            return 'light';
        }

        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored;
        }

        return 'light';
    });

    const resolvedTheme: ResolvedTheme =
        theme === 'system' ? getSystemTheme() : theme;

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        }

        applyTheme(newTheme);
    };

    const toggleTheme = () => {
        const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';

        setTheme(nextTheme);
    };

    useEffect(() => {
        applyTheme(theme);

        if (theme === 'system') {
            const mediaQuery = window.matchMedia(
                '(prefers-color-scheme: dark)',
            );

            const handleChange = () => {
                applyTheme('system');
            };

            mediaQuery.addEventListener('change', handleChange);

            return () => {
                mediaQuery.removeEventListener('change', handleChange);
            };
        }
    }, [theme]);

    return {
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
    };
}
