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

function runtimeSetting(name: string): string {
    return (
        document
            .querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
            ?.content.trim() ?? ''
    );
}

export function getEcho(): Echo<'reverb'> | null {
    if (typeof window === 'undefined') {
        return null;
    }

    if (
        document.querySelector<HTMLMetaElement>(
            'meta[name="broadcasting-enabled"]',
        )?.content === 'false'
    ) {
        return null;
    }

    if (!window.Echo) {
        const port =
            runtimeSetting('reverb-port') || import.meta.env.VITE_REVERB_PORT;
        const scheme =
            runtimeSetting('reverb-scheme') ||
            import.meta.env.VITE_REVERB_SCHEME ||
            'http';

        window.Echo = new Echo<'reverb'>({
            broadcaster: 'reverb',
            key:
                runtimeSetting('reverb-key') ||
                import.meta.env.VITE_REVERB_APP_KEY ||
                'reverb-key',
            // An empty host means "the host serving this page", so one image
            // works from phones, tablets, and other LAN devices.
            wsHost:
                runtimeSetting('reverb-host') ||
                import.meta.env.VITE_REVERB_HOST ||
                window.location.hostname,
            wsPort: port ? Number(port) : 8080,
            wssPort: port ? Number(port) : 443,
            forceTLS: scheme === 'https',
            enabledTransports: ['ws', 'wss'],
        });
    }

    return window.Echo;
}
