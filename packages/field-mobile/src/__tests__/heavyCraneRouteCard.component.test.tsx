import { fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import {
    HeavyCraneRouteCard,
    type HeavyCraneRouteStatus,
} from '../components/HeavyCraneRouteCard';

describe('HeavyCraneRouteCard', () => {
    it('renders the crane label, route details, and synchronized list alternative', async () => {
        const onOpenRoute = jest.fn();

        const view = await render(
            <HeavyCraneRouteCard
                assetLabel="CRN-07 · 50-ton mobile crane"
                currentLabel="North Harbor depot"
                destinationLabel="Pier 7 East Gate"
                distanceLabel="4.8 km"
                etaLabel="18 min"
                lastSyncedAt="2 minutes ago"
                onOpenRoute={onOpenRoute}
                stagingLabel="Pier 7 staging area"
                status="available"
            />,
        );

        expect(view.getByText('Heavy-crane route')).toBeTruthy();
        expect(view.getByText('CRN-07 · 50-ton mobile crane')).toBeTruthy();
        expect(view.getByText('Route available')).toBeTruthy();
        expect(view.getByText('North Harbor depot')).toBeTruthy();
        expect(view.getByText('Pier 7 East Gate')).toBeTruthy();
        expect(view.getByText('Pier 7 staging area')).toBeTruthy();
        expect(view.getByText('Synchronized assignment details')).toBeTruthy();

        fireEvent.press(view.getByTestId('heavy-crane-route-card-open-route'));
        expect(onOpenRoute).toHaveBeenCalledTimes(1);
    });

    it.each<[HeavyCraneRouteStatus, string]>([
        ['cached', 'Route cached for offline use'],
        ['stale', 'Route needs refresh'],
        ['unavailable', 'Route unavailable'],
    ])(
        'labels the %s state without implying server acceptance',
        async (status, label) => {
            const view = await render(
                <HeavyCraneRouteCard
                    destinationLabel="Pier 7 East Gate"
                    lastSyncedAt={
                        status === 'unavailable' ? null : '10 minutes ago'
                    }
                    status={status}
                />,
            );

            expect(view.getByText(label)).toBeTruthy();
            expect(view.getByLabelText(`Route status: ${label}`)).toBeTruthy();
        },
    );

    it('keeps the route list honest when no route details are supplied', async () => {
        const view = await render(<HeavyCraneRouteCard />);

        expect(view.getByText('PLANNED CAPABILITY')).toBeTruthy();
        expect(view.getByText('Route review (planned)')).toBeTruthy();
        expect(
            view.getByText(
                'No route data is available for this assignment in the current mobile backend.',
            ),
        ).toBeTruthy();
        expect(view.getByText('Heavy-crane asset')).toBeTruthy();
    });
});
