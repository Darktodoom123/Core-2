import { fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import { PlannedRoutePanel } from '../components/panels/planned-route-panel';

describe('PlannedRoutePanel', () => {
    it('renders planned capability empty state when no route data is active', async () => {
        const onBackToToday = jest.fn();

        const view = await render(
            <PlannedRoutePanel onBackToToday={onBackToToday} />,
        );

        expect(view.getByTestId('planned-route-panel')).toBeTruthy();
        expect(view.getByText('PLANNED CAPABILITY')).toBeTruthy();
        expect(view.getByText('Route planning')).toBeTruthy();
        expect(view.getByText('Route data unavailable')).toBeTruthy();
        expect(
            view.getByText(
                'Route planning is not available for this assignment yet.',
            ),
        ).toBeTruthy();

        await fireEvent.press(view.getByText('Back to Today'));
        expect(onBackToToday).toHaveBeenCalledTimes(1);
    });

    it('allows previewing route corridor and toggling preview off', async () => {
        const onBackToToday = jest.fn();

        const view = await render(
            <PlannedRoutePanel
                destinationLabel="Subic Project Alpha"
                onBackToToday={onBackToToday}
            />,
        );

        // Initially in planned capability mode
        expect(view.queryByTestId('route-map')).toBeNull();

        // Click preview
        await fireEvent.press(view.getByTestId('preview-route-corridor-btn'));
        expect(await view.findByTestId('route-map')).toBeTruthy();
        expect(view.getByText('ROUTE ACTIVE')).toBeTruthy();
        expect(view.getByText('Subic Project Alpha')).toBeTruthy();

        // Click close preview
        await fireEvent.press(view.getByText('Close Route Preview'));
        expect(view.queryByTestId('route-map')).toBeNull();
        expect(view.getByText('PLANNED CAPABILITY')).toBeTruthy();
    });

    it('renders route active directly when hasRouteData is true', async () => {
        const onBackToToday = jest.fn();

        const view = await render(
            <PlannedRoutePanel
                destinationLabel="Batangas Yard"
                hasRouteData={true}
                onBackToToday={onBackToToday}
            />,
        );

        expect(view.getByTestId('route-map')).toBeTruthy();
        expect(view.getByText('ROUTE ACTIVE')).toBeTruthy();
        expect(view.getByText('Batangas Yard')).toBeTruthy();
    });
});
