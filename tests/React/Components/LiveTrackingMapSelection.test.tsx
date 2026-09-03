import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveTrackingMap } from '@/components/live-tracking-map';
import type { LocationUpdateViewModel } from '@/types/workspace';

vi.mock('@/components/maplibre/maplibre-map', () => ({
    MapLibreMap: () => null,
}));

const location: LocationUpdateViewModel = {
    id: 1,
    user: { id: 1, name: 'Crane operator' },
    asset: {
        id: 1,
        code: 'CRN-101',
        name: 'Mobile crane',
        kind: 'mobile_crane',
    },
    job: null,
    latitude: 14.6,
    longitude: 121,
    accuracy_metres: 4,
    speed: null,
    remarks: null,
    source: 'browser',
    sharing_enabled: true,
    captured_at: null,
    received_at: null,
    freshness_status: 'offline',
};

describe('LiveTrackingMap controlled selection', () => {
    it('respects an explicit cleared selection even after a unit was selected', () => {
        const onSelect = vi.fn();
        const { rerender } = render(
            <LiveTrackingMap
                locations={[location]}
                selectedLocationId={1}
                onSelectedLocationChange={onSelect}
            />,
        );
        fireEvent.click(screen.getByRole('button', { pressed: true }));
        expect(onSelect).toHaveBeenCalledWith(1);
        rerender(
            <LiveTrackingMap
                locations={[location]}
                selectedLocationId={null}
                onSelectedLocationChange={onSelect}
            />,
        );
        expect(
            screen.queryByRole('button', { pressed: true }),
        ).not.toBeInTheDocument();
    });

    it('preserves the initial standalone selection and accepts embedding classes', () => {
        render(
            <LiveTrackingMap
                locations={[location]}
                className="rounded-none border-0"
            />,
        );
        expect(
            screen.getByRole('button', { pressed: true }),
        ).toBeInTheDocument();
        expect(screen.getByTestId('live-tracking-map')).toHaveClass(
            'rounded-none',
            'border-0',
        );
    });
});
