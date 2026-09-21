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

    it('separates stale state from report age in the synchronized list row', () => {
        render(
            <LiveTrackingMap
                locations={[
                    {
                        ...location,
                        freshness_status: 'stale',
                        received_at: new Date().toISOString(),
                    },
                ]}
            />,
        );

        const selectedRow = screen.getByRole('button', { pressed: true });

        expect(selectedRow).toHaveTextContent('Last known location');
        expect(selectedRow).toHaveTextContent(
            'Reported Less than a minute ago',
        );
    });

    it('keeps mobile Map/List controls and the shared asset search synchronized', () => {
        const secondLocation: LocationUpdateViewModel = {
            ...location,
            id: 2,
            asset: {
                ...location.asset!,
                id: 2,
                code: 'TRK-202',
                name: 'Transport truck',
                kind: 'truck',
            },
            latitude: null,
            longitude: null,
            recorded_location: 'North Yard',
            has_gps_report: false,
        };

        render(
            <LiveTrackingMap
                locations={[location, secondLocation]}
                compact
                showLocationList
            />,
        );

        expect(
            screen.getByRole('group', { name: 'Fleet map view' }),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', { name: 'Hide asset list' }),
        );
        expect(
            screen.getByRole('button', { name: 'Show asset list' }),
        ).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(
            screen.getByRole('button', { name: 'Show asset list' }),
        );

        fireEvent.click(screen.getByRole('button', { name: /^list$/i }));

        const search = screen.getByRole('searchbox', {
            name: 'Search fleet map',
        });
        fireEvent.change(search, { target: { value: 'TRK-202' } });

        expect(screen.getByText('TRK-202')).toBeInTheDocument();
        expect(screen.queryByText('CRN-101')).not.toBeInTheDocument();
        expect(screen.getAllByText('No GPS report').length).toBeGreaterThan(0);
    });

    it('exposes a keyboard-safe compact map settings menu', () => {
        render(<LiveTrackingMap locations={[location]} compact />);

        const trigger = screen.getByRole('button', { name: 'Map options' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(trigger);

        const menu = screen.getByRole('menu', { name: 'Map options' });
        expect(menu).toBeVisible();
        expect(
            screen.getByRole('menuitemradio', { name: 'light' }),
        ).toHaveAttribute('aria-checked', 'true');

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(menu).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
