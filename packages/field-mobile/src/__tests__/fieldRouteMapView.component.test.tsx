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
        fireEvent.press(view.getByTestId('field-route-map-view-wp-wp-2'));
        expect(view.getByTestId('field-route-map-view-canvas')).toBeTruthy();
    });

    it('renders offline cache status when indicated', async () => {
        const view = await render(
            <FieldRouteMapView routeStatus="cached" />,
        );

        expect(view.getByText('Offline Route Cache Active')).toBeTruthy();
    });
});
