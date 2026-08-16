import { fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import { FieldRouteMapView } from '../components/map/FieldRouteMapView';

describe('FieldRouteMapView', () => {
    it('renders metrics bar, corridor waypoints, and hazard callouts', async () => {
        const view = await render(
            <FieldRouteMapView
                clearanceHeightMetres={4.5}
                destinationLabel="Subic Bay Container Terminal"
                distanceKm={24.2}
                etaMinutes={45}
                maxAxleWeightTons={50}
                originLabel="Manila Central Depot"
            />,
        );

        expect(view.getByText('EST. TIME')).toBeTruthy();
        expect(view.getByText(/45/)).toBeTruthy();
        expect(view.getByText('DISTANCE')).toBeTruthy();
        expect(view.getByText(/24\.2/)).toBeTruthy();
        expect(view.getByText('CLEARANCE')).toBeTruthy();
        expect(view.getByText(/4\.5/)).toBeTruthy();

        expect(view.getByText('Manila Central Depot')).toBeTruthy();
        expect(view.getByText('Subic Bay Container Terminal')).toBeTruthy();
        expect(view.getByText('Old Mill Overpass')).toBeTruthy();
        expect(
            view.getByText('Bridge 4.1m clearance — use outer lane'),
        ).toBeTruthy();

        // Select a waypoint
        await fireEvent.press(view.getByTestId('field-route-map-view-wp-wp-2'));
        expect(view.getByTestId('field-route-map-view-canvas')).toBeTruthy();
    });

    it('renders offline cache status when indicated', async () => {
        const view = await render(<FieldRouteMapView routeStatus="cached" />);

        expect(view.getByText('Offline Route Cache Active')).toBeTruthy();
    });

    it('supports tab switching between MapLibre map and corridor steps view', async () => {
        const view = await render(
            <FieldRouteMapView
                destinationLabel="Pier 7 Terminal"
                originLabel="North Depot"
            />,
        );

        expect(
            view.getByTestId('field-route-map-view-tab-corridor').props
                .accessibilityState.selected,
        ).toBe(true);
        expect(
            view.getByTestId('field-route-map-view-tab-map').props
                .accessibilityState.selected,
        ).toBe(false);

        // Switch to Map view
        await fireEvent.press(view.getByTestId('field-route-map-view-tab-map'));
        expect(
            view.getByTestId('field-route-map-view-tab-map').props
                .accessibilityState.selected,
        ).toBe(true);
        expect(
            view.getByTestId('field-route-map-view-tab-corridor').props
                .accessibilityState.selected,
        ).toBe(false);

        // Switch back to Corridor view
        await fireEvent.press(
            view.getByTestId('field-route-map-view-tab-corridor'),
        );
        expect(
            view.getByTestId('field-route-map-view-tab-corridor').props
                .accessibilityState.selected,
        ).toBe(true);
    });

    it('renders live corridor status indicator', async () => {
        const view = await render(<FieldRouteMapView routeStatus="live" />);

        expect(
            view.getByText(
                'Heavy Transport Corridor Verified (Live GPS Active)',
            ),
        ).toBeTruthy();
    });
});
