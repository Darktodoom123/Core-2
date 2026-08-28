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
        url: '/',
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
    },
    Link: ({ children, href, ...props }: { children: React.ReactNode; href?: string; [key: string]: unknown }) => {
        return React.createElement('a', { href, ...props }, children);
    },
    Head: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));
