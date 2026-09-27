import assert from 'node:assert/strict';
import test from 'node:test';
import { directionsUrl } from '../components/cards/job-card/job-directions.js';

const MAPS = 'https://www.google.com/maps/dir/?api=1&destination=';

test('uses the exact site pin when dispatch set coordinates', () => {
    assert.equal(
        directionsUrl({
            site: 'C-5 Flyover, Taguig',
            site_latitude: 14.5176,
            site_longitude: 121.0509,
        }),
        `${MAPS}14.5176%2C121.0509`,
    );
});

test('falls back to the site address when there is no pin', () => {
    assert.equal(
        directionsUrl({ site: 'C-5 Flyover, Taguig' }),
        `${MAPS}C-5%20Flyover%2C%20Taguig`,
    );
});

test('ignores coordinates that are out of range or missing a half', () => {
    assert.equal(
        directionsUrl({
            site: 'Pier 4',
            site_latitude: 95,
            site_longitude: 121,
        }),
        `${MAPS}Pier%204`,
    );
    assert.equal(
        directionsUrl({
            site: 'Pier 4',
            site_latitude: 14.5,
            site_longitude: null,
        }),
        `${MAPS}Pier%204`,
    );
});

test('offers no directions when the job has no place to go', () => {
    assert.equal(directionsUrl({ site: '   ' }), null);
});
