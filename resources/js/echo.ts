import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo: Echo<'reverb'>;
    }
}

if (typeof window !== 'undefined') {
    window.Pusher = Pusher;
}

export function reconnectEcho(): void {
    const echo = getEcho();

    if (!echo) {
        return;
    }

    const pusher = echo.connector.pusher;

    if (
        pusher.connection.state === 'connected' ||
        pusher.connection.state === 'connecting'
    ) {
        return;
    }

    pusher.connect();
}

export function getEcho(): Echo<'reverb'> | null {
    if (typeof window === 'undefined') {
        return null;
    }

    if (!window.Echo) {
        window.Echo = new Echo<'reverb'>({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY ?? 'reverb-key',
            wsHost:
                import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
            wsPort: import.meta.env.VITE_REVERB_PORT
                ? Number(import.meta.env.VITE_REVERB_PORT)
                : 8080,
            wssPort: import.meta.env.VITE_REVERB_PORT
                ? Number(import.meta.env.VITE_REVERB_PORT)
                : 443,
            forceTLS:
                (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
            enabledTransports: ['ws', 'wss'],
        });
    }

    return window.Echo;
}
