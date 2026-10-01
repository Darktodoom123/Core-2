import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLocationName } from '@/lib/asset-kind';
import {
    clearPlaceCache,
    getCachedLocationName,
    getCoordinatesCacheKey,
    onLocationResolved,
    primePlace,
    reverseGeocode,
    setCachedLocationName,
} from '@/services/reverse-geocoder';

function serverPlace(primary: string, secondary: string | null = null) {
    return {
        ok: true,
        json: async () => ({
            data: {
                status: 'resolved',
                primary,
                secondary,
                provider: 'stadia',
            },
        }),
    } as Response;
}

beforeEach(() => {
    clearPlaceCache();
    vi.restoreAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Location Resolution Hierarchy', () => {
    it('prioritizes live coordinates over assigned job site to show current physical location', () => {
        setCachedLocationName(14.5547, 121.0244, 'Ayala Avenue, Makati');

        const result = resolveLocationName({
            job: { site: 'Pier 4 Expansion Project' },
            asset: { location: 'Central Yard Depot' },
            latitude: 14.5547,
            longitude: 121.0244,
        });
        expect(result).toBe('Ayala Avenue, Makati');
    });

    it('labels the assigned job site so it is never mistaken for a live position', () => {
        const result = resolveLocationName({
            job: { site: 'Pier 4 Expansion Project' },
            asset: { location: 'Central Yard Depot' },
            latitude: null,
            longitude: null,
        });
        expect(result).toBe('Job site: Pier 4 Expansion Project (no live GPS)');
    });

    it('labels the asset base when job site and coordinates are absent', () => {
        const result = resolveLocationName({
            job: null,
            asset: { location: 'North Warehouse Berth 2' },
            latitude: null,
            longitude: null,
        });
        expect(result).toBe('Base: North Warehouse Berth 2 (no live GPS)');
    });

    it('uses the place the server already sent without a request', () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        const result = resolveLocationName({
            latitude: 14.762045,
            longitude: 121.07749,
            place: {
                status: 'resolved',
                primary: 'Purificacion Street',
                secondary: 'Bernabe Heights, Caloocan',
                provider: 'stadia',
            },
        });

        expect(result).toBe('Purificacion Street, Bernabe Heights');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('shows Finding address… and asks the server when uncached coordinates are provided', () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(serverPlace('Somewhere'));

        const result = resolveLocationName({
            latitude: 14.9999,
            longitude: 120.8888,
        });

        expect(result).toBe('Finding address…');
        expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
            '/operations/places/reverse?latitude=14.9999&longitude=120.8888',
        );
    });

    it('says there is no GPS fix when nothing is known', () => {
        expect(resolveLocationName({ latitude: null, longitude: null })).toBe(
            'No GPS fix',
        );
    });
});

describe('Reverse Geocoder Service', () => {
    it('keys the cache at five decimals (~1 m), matching the server', () => {
        expect(getCoordinatesCacheKey(14.554712, 121.024409)).toBe(
            '14.55471,121.02441',
        );
        expect(getCoordinatesCacheKey(14.554749, 121.024401)).toBe(
            '14.55475,121.02440',
        );
    });

    it('resolves through the Operations server, never a third party, and caches the result', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                serverPlace('Ayala Triangle Gardens', 'Bel-Air, Makati'),
            );

        expect(await reverseGeocode(14.557, 121.023)).toBe(
            'Ayala Triangle Gardens, Bel-Air',
        );
        expect(getCachedLocationName(14.557, 121.023)).toBe(
            'Ayala Triangle Gardens, Bel-Air',
        );
        expect(await reverseGeocode(14.557, 121.023)).toBe(
            'Ayala Triangle Gardens, Bel-Air',
        );

        expect(fetchSpy).toHaveBeenCalledOnce();
        const url = String(fetchSpy.mock.calls[0]?.[0]);
        expect(url.startsWith('/operations/places/reverse?')).toBe(true);
        expect(url).not.toMatch(/photon|bigdatacloud|stadiamaps/);
    });

    it('notifies registered listeners when a location is resolved', async () => {
        const listener = vi.fn();
        const unsubscribe = onLocationResolved(listener);
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            serverPlace('Roxas Boulevard', 'Manila'),
        );

        await reverseGeocode(14.58, 120.98);

        expect(listener).toHaveBeenCalledWith(
            getCoordinatesCacheKey(14.58, 120.98),
            'Roxas Boulevard, Manila',
        );
        unsubscribe();
    });

    it('never passes coordinates off as a place name when the lookup fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new Error('Network offline'),
        );

        expect(await reverseGeocode(14.1234, 121.5678)).toBeNull();
        expect(
            resolveLocationName({ latitude: 14.1234, longitude: 121.5678 }),
        ).toBe('Address unavailable');
    });

    it('ignores pending server places so the lookup still runs', () => {
        primePlace(10, 20, {
            status: 'pending',
            primary: null,
            secondary: null,
            provider: null,
        });

        expect(getCachedLocationName(10, 20)).toBeNull();
    });
});
