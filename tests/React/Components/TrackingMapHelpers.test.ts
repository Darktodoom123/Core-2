import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { groupOverlappingMarkers } from '@/components/maplibre/marker-overlap';
import { createMarkerGroup } from '@/components/maplibre/markers';
import {
    createTrackingGroupPopup,
    createTrackingLocationPopup,
    formatReportAge,
} from '@/components/maplibre/tracking-map-popups';
import type { LocationUpdateViewModel } from '@/types/workspace';

const location: LocationUpdateViewModel = {
    id: 1,
    user: { id: 1, name: 'Operator' },
    asset: {
        id: 1,
        code: 'CRN-101',
        name: 'Mobile crane',
        kind: 'mobile_crane',
    },
    job: { id: 1, reference: 'JOB-1', title: 'Lift', site: 'Assigned project' },
    latitude: 14.6,
    longitude: 121,
    accuracy_metres: 4,
    speed: null,
    remarks: null,
    source: 'browser',
    sharing_enabled: true,
    captured_at: '2026-09-03T01:00:00Z',
    received_at: '2026-09-03T01:02:00Z',
    freshness_status: 'offline',
};

describe('tracking map overlap grouping', () => {
    it('retains every unit at identical coordinates in one selectable group', () => {
        const values = Array.from({ length: 250 }, (_, id) => ({
            value: id,
            x: 100,
            y: 100,
        }));
        expect(groupOverlappingMarkers(values)).toEqual([
            values.map(({ value }) => value),
        ]);
    });

    it('groups overlapping points across spatial bucket boundaries', () => {
        expect(
            groupOverlappingMarkers([
                { value: 'one', x: 43, y: -1 },
                { value: 'two', x: 45, y: 1 },
                { value: 'distant', x: 140, y: 140 },
            ]),
        ).toEqual([['one', 'two'], ['distant']]);
    });

    it('separates units when zoom projects them beyond the touch target', () => {
        expect(
            groupOverlappingMarkers([
                { value: 1, x: 0, y: 0 },
                { value: 2, x: 44, y: 0 },
            ]),
        ).toEqual([[1], [2]]);
    });

    it('anchors SOS before grouping so repositioning cannot hide a neighboring unit', () => {
        const markers = [
            { value: 'regular-left', x: 0, y: 0 },
            { value: 'sos', x: 43, y: 0, priority: 1 },
            { value: 'regular-right', x: 44, y: 0 },
        ];
        expect(groupOverlappingMarkers(markers)).toEqual([
            ['sos', 'regular-left', 'regular-right'],
        ]);
        expect(markers[0].value).toBe('regular-left');
    });

    it('keeps each group near its real anchor rather than chaining distant units together', () => {
        expect(
            groupOverlappingMarkers([
                { value: 1, x: 0, y: 0 },
                { value: 2, x: 30, y: 0 },
                { value: 3, x: 60, y: 0 },
            ]),
        ).toEqual([[1, 2], [3]]);
        expect(groupOverlappingMarkers([])).toEqual([]);
    });
});

describe('tracking map popup behavior', () => {
    it('offers every overlapping unit, preserves SOS text, and safely renders external labels', () => {
        const first = vi.fn();
        const second = vi.fn();
        const popup = createTrackingGroupPopup([
            {
                label: '<img src=x onerror=alert(1)>',
                description: 'offline',
                hasSos: false,
                onSelect: first,
            },
            {
                label: 'CRN-101',
                description: 'Active emergency',
                hasSos: true,
                onSelect: second,
            },
        ]);
        const buttons = within(popup).getAllByRole('button');
        expect(buttons).toHaveLength(2);
        expect(popup.querySelector('img')).toBeNull();
        expect(buttons[1]).toHaveTextContent('SOS · CRN-101');
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[1]);
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
    });

    it('keeps an SOS count marker explicit and honors reduced motion', () => {
        const marker = createMarkerGroup({
            count: 3,
            sos: {
                status: 'active',
                label: 'Active SOS',
                prefersReducedMotion: true,
            },
        });
        expect(marker).toHaveAccessibleName(
            '3 units in this area. Includes SOS incidents. Select a unit',
        );
        expect(marker).toHaveTextContent('SOS');
        expect(marker).toHaveTextContent('3');
        expect(marker.dataset.sosActive).toBe('true');
        expect(
            marker.querySelector<HTMLElement>('.maplibre-sos-marker__halo')
                ?.style.animation,
        ).toBe('none');
    });

    it('shows old coordinates as reported positions, distinct timestamps, and unavailable speed', () => {
        const popup = createTrackingLocationPopup(location);
        expect(popup).toHaveTextContent(
            'Last reported position; current position is unknown.',
        );
        expect(popup).toHaveTextContent('Captured');
        expect(popup).toHaveTextContent('Received');
        expect(popup).toHaveTextContent('Reported speedUnavailable');
        expect(popup).toHaveTextContent('Assigned siteAssigned project');
        expect(popup).not.toHaveTextContent('Stationary');
        expect(popup).not.toHaveTextContent('Wind Speed');
        expect(popup).not.toHaveTextContent('Weather');
    });

    it('supports a labeled coordinate copy action', () => {
        const onCopy = vi.fn();
        const popup = createTrackingLocationPopup(location, undefined, onCopy);
        expect(popup).toHaveTextContent('14.60000, 121.00000');
        fireEvent.click(
            within(popup).getByRole('button', { name: 'Copy coordinates' }),
        );
        expect(onCopy).toHaveBeenCalledOnce();
    });

    it('formats the report age without treating invalid timestamps as current', () => {
        const now = Date.parse('2026-09-03T03:10:00Z');
        expect(formatReportAge('2026-09-03T01:00:00Z', now)).toBe('2h 10m ago');
        expect(formatReportAge(null, now)).toBe('Time unavailable');
        expect(formatReportAge('invalid', now)).toBe('Time unavailable');
    });
});
