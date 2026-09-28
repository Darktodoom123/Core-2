import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WeatherSafetyTelemetry } from '@/components/weather/weather-safety-telemetry';

afterEach(() => {
    vi.unstubAllGlobals();
});

it('does not request or invent site weather without pinned coordinates', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
        <WeatherSafetyTelemetry variant="site" locationLabel="Batangas Port" />,
    );

    expect(screen.getByText(/Site weather unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/coordinates not recorded/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
        screen.queryByText(
            /Safe lift window|Bearing stable|No strikes detected/,
        ),
    ).not.toBeInTheDocument();
});

it('shows only provider-supported weather and its source for pinned coordinates', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                current: {
                    time: '2026-09-27T09:00',
                    temperature_2m: 30,
                    relative_humidity_2m: 70,
                    weather_code: 2,
                    wind_speed_10m: 12,
                    wind_direction_10m: 45,
                    wind_gusts_10m: 20,
                },
            }),
        }),
    );

    render(
        <WeatherSafetyTelemetry
            variant="site"
            latitude={13.7565}
            longitude={121.0583}
            locationLabel="Batangas Port"
        />,
    );

    await waitFor(() =>
        expect(
            screen.getByText(/Open-Meteo current model conditions/),
        ).toBeInTheDocument(),
    );
    expect(screen.getByText(/12 km\/h/)).toBeInTheDocument();
    expect(
        screen.getByText(/does not establish ground bearing/),
    ).toBeInTheDocument();
    expect(
        screen.queryByText(/Live Satellite|GO: SAFE LIFT WINDOW/),
    ).not.toBeInTheDocument();
});

it('does not replace a failed provider response with synthetic conditions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(
        <WeatherSafetyTelemetry
            variant="site"
            latitude={13.7}
            longitude={121.0}
        />,
    );

    await waitFor(() =>
        expect(
            screen.getByText(/Open-Meteo weather is unavailable/),
        ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/°C|km\/h/)).not.toBeInTheDocument();
});
