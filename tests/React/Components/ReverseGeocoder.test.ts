import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLocationName } from '@/lib/asset-kind';
import {
    getCachedLocationName,
    getCoordinatesCacheKey,
    onLocationResolved,
    reverseGeocode,
    setCachedLocationName,
} from '@/services/reverse-geocoder';

describe('Location Resolution Hierarchy', () => {
    it('prioritizes assigned job site over asset location and coordinates', () => {
        const result = resolveLocationName({
            job: { site: 'Pier 4 Expansion Project' },
            asset: { location: 'Central Yard Depot' },
            latitude: 14.5547,
            longitude: 121.0244,
        });
        expect(result).toBe('Pier 4 Expansion Project');
    });

    it('falls back to asset base location when job site is absent', () => {
        const result = resolveLocationName({
            job: null,
            asset: { location: 'North Warehouse Berth 2' },
            latitude: 14.5547,
            longitude: 121.0244,
        });
        expect(result).toBe('North Warehouse Berth 2');
    });

    it('returns cached reverse-geocoded location when available', () => {
        setCachedLocationName(14.5547, 121.0244, 'Ayala Avenue, Makati');

        const result = resolveLocationName({
            job: null,
            asset: null,
            latitude: 14.5547,
            longitude: 121.0244,
        });
        expect(result).toBe('Ayala Avenue, Makati');
    });

    it('returns Locating… and initiates geocoding when uncached coordinates are provided', () => {
        const result = resolveLocationName({
            job: null,
            asset: null,
            latitude: 14.9999,
            longitude: 120.8888,
        });
        expect(result).toBe('Locating…');
    });

    it('returns Site Location Unavailable when no job, asset, or coordinates are provided', () => {
        const result = resolveLocationName({
            job: null,
            asset: null,
            latitude: null,
            longitude: null,
        });
        expect(result).toBe('Site Location Unavailable');
    });
});

describe('Reverse Geocoder Service', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('generates consistent cache keys rounded to 4 decimals (~11m precision)', () => {
        expect(getCoordinatesCacheKey(14.554712, 121.024409)).toBe(
            '14.5547,121.0244',
        );
        expect(getCoordinatesCacheKey(14.554749, 121.024401)).toBe(
            '14.5547,121.0244',
        );
    });

    it('resolves location name via Photon API and caches result', async () => {
        const mockPhotonResponse = {
            features: [
                {
                    properties: {
                        name: 'Ayala Triangle Gardens',
                        locality: 'Bel-Air',
                        city: 'Makati',
                        country: 'Philippines',
                    },
                },
            ],
        };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => mockPhotonResponse,
        } as Response);

        const name = await reverseGeocode(14.557, 121.023);
        expect(name).toBe('Ayala Triangle Gardens, Bel-Air, Makati');
        expect(getCachedLocationName(14.557, 121.023)).toBe(
            'Ayala Triangle Gardens, Bel-Air, Makati',
        );
        expect(fetchSpy).toHaveBeenCalledOnce();

        // Second call should hit the cache without calling fetch again
        const cachedName = await reverseGeocode(14.557, 121.023);
        expect(cachedName).toBe('Ayala Triangle Gardens, Bel-Air, Makati');
        expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('notifies registered listeners when a location is resolved', async () => {
        const listener = vi.fn();
        const unsubscribe = onLocationResolved(listener);

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                features: [
                    {
                        properties: {
                            name: 'Roxas Boulevard',
                            city: 'Manila',
                        },
                    },
                ],
            }),
        } as Response);

        await reverseGeocode(14.58, 120.98);
        const expectedKey = getCoordinatesCacheKey(14.58, 120.98);

        expect(listener).toHaveBeenCalledWith(
            expectedKey,
            'Roxas Boulevard, Manila',
        );

        unsubscribe();
    });

    it('falls back gracefully to GPS coordinates string when APIs are unreachable', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new Error('Network offline'),
        );

        const fallback = await reverseGeocode(14.1234, 121.5678);
        expect(fallback).toBe('GPS 14.1234°, 121.5678°');
    });
});
