import { createInertiaApp, router } from '@inertiajs/react';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

if (typeof window !== 'undefined') {
    router.on('networkError', (event) => {
        if (event.detail.error instanceof Error) {
            console.error('[Inertia:NetworkError]', event.detail.error.message);
        }
    });

    router.on('httpException', (event) => {
        const response = event.detail.response;

        if (response && response.status >= 500) {
            console.error(
                `[Inertia:ServerError] Server returned HTTP ${response.status}`,
            );
        }
    });
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        color: '#4B5563',
    },
});
