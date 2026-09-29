import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'core2-theme-preference';
const themeListeners = new Set<() => void>();

function isTheme(value: string | null): value is Theme {
    return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredTheme(): Theme {
    if (typeof window === 'undefined') {
        return 'light';
    }

    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

        return isTheme(stored) ? stored : 'light';
    } catch {
        return 'light';
    }
}

function getThemeSnapshot(): Theme {
    return readStoredTheme();
}

function getServerThemeSnapshot(): Theme {
    if (typeof window === 'undefined') {
        return 'light';
    }

    const bootstrappedTheme = document.documentElement.getAttribute(
        'data-theme-preference',
    );

    return isTheme(bootstrappedTheme) ? bootstrappedTheme : 'light';
}

function notifyThemeListeners(): void {
    themeListeners.forEach((listener) => listener());
}

function handleStorageChange(event: StorageEvent): void {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) {
        return;
    }

    notifyThemeListeners();
}

function subscribeToTheme(listener: () => void): () => void {
    themeListeners.add(listener);

    if (themeListeners.size === 1 && typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
    }

    return () => {
        themeListeners.delete(listener);

        if (themeListeners.size === 0 && typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
        }
    };
}

export function getSystemTheme(): ResolvedTheme {
    if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
    ) {
        return 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function getServerSystemTheme(): ResolvedTheme {
    return 'light';
}

function subscribeToSystemTheme(listener: () => void): () => void {
    if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
    ) {
        return () => undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        applyTheme('system');
        listener();
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
}

export function applyTheme(theme: Theme): ResolvedTheme {
    if (typeof window === 'undefined') {
        return 'light';
    }

    const resolved: ResolvedTheme =
        theme === 'system' ? getSystemTheme() : theme;
    const root = document.documentElement;

    root.classList.toggle('dark', resolved === 'dark');
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-preference', theme);

    return resolved;
}

export function useTheme() {
    const theme = useSyncExternalStore(
        subscribeToTheme,
        getThemeSnapshot,
        getServerThemeSnapshot,
    );
    const systemTheme = useSyncExternalStore(
        subscribeToSystemTheme,
        getSystemTheme,
        getServerSystemTheme,
    );
    const resolvedTheme: ResolvedTheme =
        theme === 'system' ? systemTheme : theme;

    const setTheme = useCallback((newTheme: Theme) => {
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
            } catch {
                // Keep the current page usable when browser storage is unavailable.
            }
        }

        applyTheme(newTheme);
        notifyThemeListeners();
    }, []);

    const toggleTheme = () => {
        const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';

        setTheme(nextTheme);
    };

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    return {
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
    };
}
