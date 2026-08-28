import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import React, { act } from 'react';
import { TowerCraneWeatherCard } from '../components/cards/TowerCraneWeatherCard';
import type { SiteWeatherTelemetry } from '../types/index';

const mockSafeWeather: SiteWeatherTelemetry = {
    latitude: 14.5995,
    longitude: 120.9842,
    temperature_celsius: 28.5,
    wind_speed_kmh: 22.4,
    wind_gusts_kmh: 28.0,
    rain_intensity_mmh: 0.0,
    humidity_percent: 78,
    weather_description: 'Clear',
    safety_level: 'safe_normal',
    safety_message:
        'Normal Conditions: Wind speed within safe operating limits (< 36 km/h). Standard hoisting permitted.',
    source: 'tomorrow_io',
    fetched_at: '2026-08-28T12:00:00Z',
    job_id: 101,
    job_reference: 'DISP-TOWER-101',
    site_name: 'BGC Corporate Center',
};

const mockCriticalWeather: SiteWeatherTelemetry = {
    ...mockSafeWeather,
    wind_speed_kmh: 49.5,
    wind_gusts_kmh: 62.0,
    rain_intensity_mmh: 12.5,
    weather_description: 'Thunderstorm',
    safety_level: 'critical_stop_work',
    safety_message:
        'Mandatory Stop Work: Wind speed exceeds DOLE 45 km/h safety limit. Engage free-slew (weather-vane) mode immediately.',
};

describe('TowerCraneWeatherCard', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    it('renders safe operating weather with Tomorrow.io telemetry', async () => {
        const onRefresh = jest.fn();
        const onReportStandby = jest.fn();

        const view = await render(
            <TowerCraneWeatherCard
                weather={mockSafeWeather}
                onRefresh={onRefresh}
                onReportStandby={onReportStandby}
            />,
        );

        expect(view.getByText('Tower Masthead Weather')).toBeTruthy();
        expect(view.getByText('SAFE TO OPERATE (< 36 km/h)')).toBeTruthy();
        expect(view.getByText('22.4 km/h')).toBeTruthy();
        expect(view.getByText('28.5°C')).toBeTruthy();
        expect(view.getByText('Source: Tomorrow.io Radar')).toBeTruthy();

        fireEvent.press(view.getByTestId('weather-refresh-btn'));
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('renders critical DOLE stop work alert when wind exceeds 45 km/h', async () => {
        const view = await render(
            <TowerCraneWeatherCard weather={mockCriticalWeather} />,
        );

        expect(view.getByText('MANDATORY STOP WORK (≥ 45 km/h)')).toBeTruthy();
        expect(view.getByText('49.5 km/h')).toBeTruthy();
        expect(view.getByText('62 km/h')).toBeTruthy();
        expect(view.getByText(/Mandatory Stop Work/)).toBeTruthy();
    });

    it('opens standby delay modal and submits cab anemometer reading', async () => {
        const onReportStandby = jest.fn();

        const view = await render(
            <TowerCraneWeatherCard
                weather={mockCriticalWeather}
                isStandbyModalVisible={true}
                onReportStandby={onReportStandby}
            />,
        );

        expect(view.getByText('Log Weather Standby Delay')).toBeTruthy();

        // Change anemometer value and reason
        await act(async () => {
            fireEvent.changeText(view.getByTestId('anemometer-input'), '52.0');
            fireEvent.press(view.getByTestId('reason-thunderstorm'));
        });

        // Submit
        await act(async () => {
            fireEvent.press(view.getByTestId('submit-weather-standby-btn'));
        });

        expect(onReportStandby).toHaveBeenCalledWith(
            52.0,
            'thunderstorm',
            undefined,
        );
    });
});
