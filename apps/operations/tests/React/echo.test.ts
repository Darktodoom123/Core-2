// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { getEcho, reconnectEcho } from '@/echo';

afterEach(() => {
    document
        .querySelectorAll(
            'meta[name="broadcasting-enabled"], meta[name^="reverb-"]',
        )
        .forEach((meta) => meta.remove());
    window.Echo?.disconnect();
    // @ts-expect-error reset the singleton between tests
    delete window.Echo;
});

function addMeta(name: string, content: string): void {
    const meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.append(meta);
}

it('prefers the Reverb endpoint rendered by the server over build-time values', () => {
    addMeta('reverb-key', 'server-key');
    addMeta('reverb-host', 'ws.example.test');
    addMeta('reverb-port', '443');
    addMeta('reverb-scheme', 'https');

    const options = getEcho()?.options;

    expect(options).toMatchObject({
        key: 'server-key',
        wsHost: 'ws.example.test',
        wsPort: 443,
        wssPort: 443,
        forceTLS: true,
    });
});

it('connects to the page host when the server leaves the host empty', () => {
    addMeta('reverb-key', 'server-key');
    addMeta('reverb-host', '');
    addMeta('reverb-port', '443');
    addMeta('reverb-scheme', 'https');

    expect(getEcho()?.options.wsHost).toBe(window.location.hostname);
});

it('does not start Reverb when the server disables broadcasting', () => {
    const marker = document.createElement('meta');
    marker.name = 'broadcasting-enabled';
    marker.content = 'false';
    document.head.append(marker);

    expect(getEcho()).toBeNull();
    expect(() => reconnectEcho()).not.toThrow();
    expect(window.Echo).toBeUndefined();
});
