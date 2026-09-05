import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { LocationWeatherCard } from '../components/cards/LocationWeatherCard';
import { ThemeProvider } from '../theme';
import type { WeatherTelemetry } from '../types/index';

describe('LocationWeatherCard Component', () => {
    it('renders error state with retry affordance when weather prop is undefined or null', async () => {
        const onRefresh = jest.fn();
        const view = await render(
            <LocationWeatherCard onRefresh={onRefresh} />,
        );

        expect(view.getByTestId('location-weather-card')).toBeTruthy();
        expect(view.getByText('Weather Unavailable')).toBeTruthy();
        expect(
            view.getByText(
                'Tap retry to check live wind speed and site conditions.',
            ),
        ).toBeTruthy();
        expect(view.getByText('Retry')).toBeTruthy();

        const retryBtn = view.getByTestId('weather-refresh-btn');
        fireEvent.press(retryBtn);
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('renders explicit error message when error prop is provided', async () => {
        const view = await render(
            <LocationWeatherCard error="GPS permission denied. Please enable in Settings." />,
        );

        expect(view.getByTestId('location-weather-card')).toBeTruthy();
        expect(view.getByText('Location Access Needed')).toBeTruthy();
        expect(
            view.getByText(
                'Allow location in your phone settings to see site wind and safety.',
            ),
        ).toBeTruthy();
    });

    it('renders loading state when isLoading is true and weather is null', async () => {
        const view = await render(<LocationWeatherCard isLoading={true} />);

        expect(view.getByTestId('location-weather-card')).toBeTruthy();
        expect(view.getByText('Finding Your Location...')).toBeTruthy();
        expect(
            view.getByText('Checking live wind speed and lifting safety...'),
        ).toBeTruthy();
        expect(view.getByTestId('weather-loading-indicator')).toBeTruthy();
    });

    it('renders custom weather telemetry with named location and safe lifting status', async () => {
        const mockWeather: WeatherTelemetry = {
            latitude: 14.82,
            longitude: 120.28,
            location_name: 'Subic Bay Port Terminal',
            temperature_celsius: 31.2,
            wind_speed_kmh: 18.4,
            wind_gusts_kmh: 24.0,
            rain_intensity_mmh: 0.0,
            humidity_percent: 68,
            weather_description: 'Partly Cloudy',
            safety_level: 'safe_normal',
            safety_message:
                'Normal Wind: Standard hoisting permitted (< 36 km/h).',
            source: 'open_meteo_live',
            fetched_at: '2026-09-06T00:00:00Z',
        };

        const view = await render(
            <LocationWeatherCard weather={mockWeather} />,
        );

        expect(view.getByText('Subic Bay Port Terminal')).toBeTruthy();
        expect(view.getByText('18 km/h')).toBeTruthy();
        expect(view.getByText('· Gusts 24 km/h')).toBeTruthy();
        expect(view.getByText('31°C')).toBeTruthy();
        expect(view.getByText('· Partly Cloudy')).toBeTruthy();
        expect(view.getByText('SAFE LIFT (< 36 KM/H)')).toBeTruthy();
    });

    it('displays caution warning pill when wind is in the 36-44 km/h caution band', async () => {
        const mockWeather: WeatherTelemetry = {
            latitude: 14.59,
            longitude: 120.98,
            location_name: 'Manila North Harbor',
            temperature_celsius: 27.0,
            wind_speed_kmh: 38.2,
            wind_gusts_kmh: 46.0,
            rain_intensity_mmh: 1.2,
            humidity_percent: 85,
            weather_description: 'Light Rain',
            safety_level: 'warning_caution',
            safety_message:
                'High Wind Caution: Gusts approaching 45 km/h maximum operating limit.',
            source: 'open_meteo_live',
            fetched_at: '2026-09-06T00:00:00Z',
        };

        const view = await render(
            <LocationWeatherCard weather={mockWeather} />,
        );

        expect(view.getByText('CAUTION (36-44 KM/H)')).toBeTruthy();
        expect(view.getByText('38 km/h')).toBeTruthy();
        expect(view.getByText('· Gusts 46 km/h')).toBeTruthy();
    });

    it('displays critical stop-work alert pill when wind exceeds 45 km/h DOLE/ASME threshold', async () => {
        const mockWeather: WeatherTelemetry = {
            latitude: 14.59,
            longitude: 120.98,
            location_name: 'Batangas Coastal Terminal',
            temperature_celsius: 24.5,
            wind_speed_kmh: 48.6,
            wind_gusts_kmh: 62.0,
            rain_intensity_mmh: 8.5,
            humidity_percent: 94,
            weather_description: 'Thunderstorm',
            safety_level: 'critical_stop_work',
            safety_message:
                'CRITICAL WIND: DOLE/ASME B30.5 crane hoisting threshold exceeded (>= 45 km/h). All lifts prohibited.',
            source: 'open_meteo_live',
            fetched_at: '2026-09-06T00:00:00Z',
        };

        const view = await render(
            <LocationWeatherCard weather={mockWeather} />,
        );

        expect(view.getByText('STOP WORK (≥ 45 KM/H)')).toBeTruthy();
        expect(view.getByText('49 km/h')).toBeTruthy();
        expect(view.getByText('· Gusts 62 km/h')).toBeTruthy();
    });

    it('triggers onRefresh callback when refresh button is tapped in live mode', async () => {
        const mockWeather: WeatherTelemetry = {
            latitude: 14.65,
            longitude: 121.05,
            location_name: 'Quezon City',
            temperature_celsius: 29.0,
            wind_speed_kmh: 12.0,
            wind_gusts_kmh: 18.0,
            rain_intensity_mmh: 0.0,
            humidity_percent: 70,
            weather_description: 'Clear Sky',
            safety_level: 'safe_normal',
            safety_message: 'Normal Wind',
            source: 'open_meteo',
            fetched_at: '2026-09-06T00:00:00Z',
        };
        const onRefresh = jest.fn();
        const view = await render(
            <LocationWeatherCard onRefresh={onRefresh} weather={mockWeather} />,
        );

        const refreshBtn = view.getByTestId('weather-refresh-btn');
        expect(refreshBtn).toBeTruthy();

        fireEvent.press(refreshBtn);
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('shows activity spinner when isLoading is true and disables refresh button', async () => {
        const mockWeather: WeatherTelemetry = {
            latitude: 14.65,
            longitude: 121.05,
            location_name: 'Quezon City',
            temperature_celsius: 29.0,
            wind_speed_kmh: 12.0,
            wind_gusts_kmh: 18.0,
            rain_intensity_mmh: 0.0,
            humidity_percent: 70,
            weather_description: 'Clear Sky',
            safety_level: 'safe_normal',
            safety_message: 'Normal Wind',
            source: 'open_meteo',
            fetched_at: '2026-09-06T00:00:00Z',
        };
        const onRefresh = jest.fn();
        const view = await render(
            <LocationWeatherCard
                isLoading={true}
                onRefresh={onRefresh}
                weather={mockWeather}
            />,
        );

        expect(view.getByTestId('weather-refresh-spinner')).toBeTruthy();
        const refreshBtn = view.getByTestId('weather-refresh-btn');
        fireEvent.press(refreshBtn);
        expect(onRefresh).not.toHaveBeenCalled();
    });

    it('renders cleanly in Dark Cockpit HUD theme mode', async () => {
        const mockWeather: WeatherTelemetry = {
            latitude: 14.65,
            longitude: 121.05,
            location_name: 'Quezon City',
            temperature_celsius: 29.0,
            wind_speed_kmh: 12.0,
            wind_gusts_kmh: 18.0,
            rain_intensity_mmh: 0.0,
            humidity_percent: 70,
            weather_description: 'Clear Sky',
            safety_level: 'safe_normal',
            safety_message: 'Normal Wind',
            source: 'open_meteo',
            fetched_at: '2026-09-06T00:00:00Z',
        };

        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <LocationWeatherCard weather={mockWeather} />
            </ThemeProvider>,
        );

        expect(view.getByTestId('location-weather-card')).toBeTruthy();
        expect(view.getByText('Quezon City')).toBeTruthy();
        expect(view.getByText('12 km/h')).toBeTruthy();
    });
});
