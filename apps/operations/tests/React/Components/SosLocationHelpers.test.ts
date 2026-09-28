import { describe, expect, it } from 'vitest';
import {
    describeSosAccuracy,
    formatSosCoordinates,
    formatSosCoordinatesDms,
} from '@/components/sos/sos-helpers';

describe('SOS location helpers', () => {
    it('keeps six decimal places so the displayed fix is never rounded coarser than GPS', () => {
        expect(formatSosCoordinates(14.762045, 121.07749)).toBe(
            '14.762045, 121.077490',
        );
        expect(formatSosCoordinates(-33.8688, 151.2093)).toBe(
            '-33.868800, 151.209300',
        );
    });

    it('formats degrees, minutes and seconds with hemispheres for radio relay', () => {
        expect(formatSosCoordinatesDms(14.762045, 121.07749)).toBe(
            `14°45'43.36"N 121°04'38.96"E`,
        );
        expect(formatSosCoordinatesDms(-33.8688, -70.5)).toBe(
            `33°52'07.68"S 70°30'00.00"W`,
        );
    });

    it('grades accuracy so responders know when to confirm by phone', () => {
        expect(describeSosAccuracy(5)).toMatchObject({
            label: '±5 m',
            tone: 'success',
        });
        expect(describeSosAccuracy(35)).toMatchObject({ tone: 'warning' });
        expect(describeSosAccuracy(250)).toMatchObject({
            label: '±250 m',
            tone: 'danger',
        });
        expect(describeSosAccuracy(null)).toMatchObject({
            label: 'Not reported',
            tone: 'default',
        });
    });
});
