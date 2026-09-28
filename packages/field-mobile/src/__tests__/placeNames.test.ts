import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import {
    configurePlaceLookup,
    formatCoordinates,
    getCachedPlaceLabel,
    placeLabel,
    primePlace,
    resetPlaceNames,
    resolvePlace,
} from '../services/placeNames';

const resolved = (primary: string, secondary: string | null = null) => ({
    status: 'resolved' as const,
    primary,
    secondary,
    provider: 'stadia',
});

describe('place names', () => {
    beforeEach(() => resetPlaceNames());

    test('uses the server first and caches the answer', async () => {
        let calls = 0;
        configurePlaceLookup({
            server: async () => {
                calls += 1;

                return resolved(
                    'Purificacion Street',
                    'Bernabe Heights, Caloocan',
                );
            },
            device: async () => {
                throw new Error('device must not be asked');
            },
        });

        const place = await resolvePlace(14.762045, 121.07749);
        await resolvePlace(14.762045, 121.07749);

        assert.equal(place.primary, 'Purificacion Street');
        assert.equal(calls, 1);
        assert.equal(
            getCachedPlaceLabel(14.762045, 121.07749),
            'Purificacion Street, Bernabe Heights',
        );
    });

    test('falls back to the device geocoder when the server is unreachable', async () => {
        configurePlaceLookup({
            server: async () => {
                throw new Error('offline');
            },
            device: async () => ({
                primary: 'Purificacion Street',
                secondary: 'Caloocan',
            }),
        });

        const place = await resolvePlace(14.7, 121.0);

        assert.equal(place.status, 'resolved');
        assert.equal(place.provider, 'device');
    });

    test('reports unavailable instead of inventing a name', async () => {
        configurePlaceLookup({
            server: async () => ({
                status: 'unavailable',
                primary: null,
                secondary: null,
                provider: null,
            }),
            device: async () => null,
        });

        const place = await resolvePlace(1.5, 2.5);

        assert.equal(place.status, 'unavailable');
        assert.equal(getCachedPlaceLabel(1.5, 2.5), null);
    });

    test('uses a place the server already sent without any lookup', () => {
        primePlace(10, 20, resolved('Ayala Avenue', 'Makati'));

        assert.equal(getCachedPlaceLabel(10, 20), 'Ayala Avenue, Makati');
    });

    test('formats coordinates at six decimals and labels with the nearest area', () => {
        assert.equal(
            formatCoordinates(14.76, 121.07749),
            '14.760000, 121.077490',
        );
        assert.equal(
            placeLabel({ primary: 'Pier 7', secondary: 'Tondo, Manila' }),
            'Pier 7, Tondo',
        );
        assert.equal(placeLabel({ primary: null, secondary: 'Manila' }), null);
    });
});
