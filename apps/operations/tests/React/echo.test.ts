// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { getEcho, reconnectEcho } from '@/echo';

afterEach(() => {
    document.querySelector('meta[name="broadcasting-enabled"]')?.remove();
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
