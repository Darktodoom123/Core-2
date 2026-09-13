import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
    cleanup();
});

// Mock Inertia router & usePage for isolated component tests
vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: {
            auth: { user: null },
            flash: {},
            errors: {},
        },
        url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        component: 'Home',
        version: null,
    }),
    router: {
        visit: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        reload: vi.fn(),
        replace: vi.fn(({ url }: { url: string }) => {
            window.history.replaceState(window.history.state, '', url);
        }),
    },
    Link: ({
        children,
        href,
        ...props
    }: {
        children: React.ReactNode;
        href?: string;
        [key: string]: unknown;
    }) => {
        return React.createElement('a', { href, ...props }, children);
    },
    Head: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    useForm: (initialValues: any = {}) => {
        const [data, setDataState] = React.useState(initialValues);
        const [errors, setErrors] = React.useState<Record<string, string>>({});
        const [processing] = React.useState(false);

        const setData = React.useCallback((keyOrFn: any, val?: any) => {
            if (typeof keyOrFn === 'function') {
                setDataState(keyOrFn);
            } else if (typeof keyOrFn === 'string') {
                setDataState((prev: any) => {
                    if (prev && prev[keyOrFn] === val) {
                        return prev;
                    }

                    return { ...prev, [keyOrFn]: val };
                });
            } else {
                setDataState(keyOrFn);
            }
        }, []);

        const isDirty = React.useMemo(() => {
            return JSON.stringify(data) !== JSON.stringify(initialValues);
        }, [data, initialValues]);

        return {
            data,
            setData,
            errors,
            setError: (key: string, message: string) =>
                setErrors((p) => ({ ...p, [key]: message })),
            clearErrors: () => setErrors({}),
            reset: () => setDataState(initialValues),
            defaults: () => {},
            isDirty,
            processing,
            post: vi.fn(),
            patch: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            get: vi.fn(),
        };
    },
}));
