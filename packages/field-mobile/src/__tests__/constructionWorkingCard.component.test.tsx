import { fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import { ConstructionWorkingCard } from '../components/cards/ConstructionWorkingCard';

describe('ConstructionWorkingCard', () => {
    it('renders all shift telemetry, delay rockers, and wind warning in Philippine operational context', async () => {
        const onLogStandby = jest.fn();
        const onRequestFuel = jest.fn();
        const onSubmitDailyProgress = jest.fn();

        const view = await render(
            <ConstructionWorkingCard
                activeWorkMinutes={255}
                jobReference="DSP-2026-0894"
                onLogStandby={onLogStandby}
                onRequestFuel={onRequestFuel}
                onSubmitDailyProgress={onSubmitDailyProgress}
                shiftElapsed="05:42:18"
                siteName="Batangas Port Pier 4 - Alibaton PH"
                standbyMinutes={87}
                weatherHoldMinutes={0}
                windSpeedKmh={42}
                windSpeedLimitKmh={38}
            />,
        );

        expect(view.getByText('WORKING ON SITE')).toBeTruthy();
        expect(view.getByText('DSP-2026-0894')).toBeTruthy();
        expect(
            view.getByText('Batangas Port Pier 4 - Alibaton PH'),
        ).toBeTruthy();
        expect(view.getByText('Shift: 05:42:18 Elapsed')).toBeTruthy();
        expect(view.getByText('4h 15m')).toBeTruthy();
        expect(view.getByText('1h 27m')).toBeTruthy();
        expect(view.getByTestId('wind-speed-badge')).toBeTruthy();

        // Interactions for field action rockers
        fireEvent.press(view.getByTestId('log-standby-button'));
        expect(onLogStandby).toHaveBeenCalledTimes(1);

        fireEvent.press(view.getByTestId('request-fuel-button'));
        expect(onRequestFuel).toHaveBeenCalledTimes(1);

        fireEvent.press(view.getByTestId('submit-daily-progress-button'));
        expect(onSubmitDailyProgress).toHaveBeenCalledTimes(1);
    });
});
