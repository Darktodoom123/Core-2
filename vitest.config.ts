import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const operationsRoot = path.join(workspaceRoot, 'apps', 'operations');

export default defineConfig({
    root: workspaceRoot,
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.join(operationsRoot, 'resources', 'js'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./apps/operations/tests/React/setup.ts'],
        include: ['apps/operations/tests/React/**/*.{test,spec}.{ts,tsx}'],
    },
});
