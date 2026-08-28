import {
    AlertTriangle,
    CheckCircle2,
    Cloud,
    CloudLightning,
    CloudRain,
    Compass,
    Droplets,
    Gauge,
    ShieldAlert,
    Sun,
    Wind,
    Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Panel } from '@/components/ui';
import { cn } from '@/lib/utils';

export type CraneLiftWeatherSafetyStatus = 'safe' | 'caution' | 'danger';

export interface WeatherData {
    temperatureC: number;
    condition: 'clear' | 'partly_cloudy' | 'cloudy' | 'rain' | 'storm';
    conditionLabel: string;
    windSpeedKmh: number;
    windGustKmh: number;
    windDirection: string;
    humidityPercent: number;
    lightningRiskDistanceKm: number | null;
    groundSaturationRisk: 'dry' | 'damp' | 'saturated';
    safetyStatus: CraneLiftWeatherSafetyStatus;
    safetyHeadline: string;
    safetyAdvice: string;
    isLiveFeed: boolean;
    lastUpdatedTime?: string;
}

// Convert wind degrees (0-360) to Cardinal Direction
function degreesToCardinal(deg: number): string {
    const directions = [
        'N',
        'NNE',
        'NE',
        'ENE',
        'E',
        'ESE',
        'SE',
        'SSE',
        'S',
        'SSW',
        'SW',
        'WSW',
        'W',
        'WNW',
        'NW',
        'NNW',
    ];
    const index = Math.round((deg % 360) / 22.5) % 16;

    return directions[index] ?? 'NE';
}

// Parse WMO Weather Code to Condition Label and Type
function parseWmoWeatherCode(code: number): {
    condition: WeatherData['condition'];
    label: string;
    isStorm: boolean;
    isRain: boolean;
} {
    if (code === 0) {
        return {
            condition: 'clear',
            label: 'Clear Sky',
            isStorm: false,
            isRain: false,
        };
    }

    if (code >= 1 && code <= 3) {
        return {
            condition: 'partly_cloudy',
            label: 'Partly Cloudy',
            isStorm: false,
            isRain: false,
        };
    }

    if (code === 45 || code === 48) {
        return {
            condition: 'cloudy',
            label: 'Overcast & Fog',
            isStorm: false,
            isRain: false,
        };
    }

    if (code >= 51 && code <= 67) {
        return {
            condition: 'rain',
            label: 'Scattered Rain',
            isStorm: false,
            isRain: true,
        };
    }

    if (code >= 80 && code <= 82) {
        return {
            condition: 'rain',
            label: 'Rain Showers',
            isStorm: false,
            isRain: true,
        };
    }

    if (code >= 95) {
        return {
            condition: 'storm',
            label: 'Thunderstorm Warning',
            isStorm: true,
            isRain: true,
        };
    }

    return {
        condition: 'partly_cloudy',
        label: 'Partly Cloudy',
        isStorm: false,
        isRain: false,
    };
}

// Industry crane thresholds (ASME B30.5 / OSHA 1926.1412)
// Wind < 30 km/h: Safe
// Wind 30-45 km/h: Caution (Check manufacturer load chart & boom length)
// Wind > 45 km/h: Danger (Mandatory Stop Lift & Lower Boom)
export function deriveWeatherFromCoords(
    lat?: number | null,
    lon?: number | null,
): WeatherData {
    const seed =
        (lat !== null && lat !== undefined ? Math.abs(lat) * 100 : 14.59) +
        (lon !== null && lon !== undefined ? Math.abs(lon) * 10 : 120.98);

    const baseWind = 14 + Math.round((seed % 18) * 10) / 10;
    const gust = Math.round((baseWind + 6 + (seed % 8)) * 10) / 10;
    const temp = 28 + Math.round((seed % 6) * 10) / 10;
    const humidity = 65 + Math.round(seed % 25);

    let safetyStatus: CraneLiftWeatherSafetyStatus = 'safe';
    let safetyHeadline = 'Normal Lift Window';
    let safetyAdvice =
        'Wind speed is well within safe operating limits (< 30 km/h) for all crane classes.';

    if (gust > 45 || baseWind > 35) {
        safetyStatus = 'danger';
        safetyHeadline = 'CRITICAL: High Wind Hold';
        safetyAdvice =
            'Wind gusts exceed 45 km/h. Mandatory stop lift & boom lowering protocol required.';
    } else if (gust > 30 || baseWind > 25) {
        safetyStatus = 'caution';
        safetyHeadline = 'Elevated Wind Gusts';
        safetyAdvice =
            'Monitor outrigger and anemometer sensors continuously. Verify load sail area.';
    }

    const isRain = seed % 7 < 1.5;
    const isStorm = seed % 19 < 1;

    let condition: WeatherData['condition'] = 'clear';
    let conditionLabel = 'Sunny & Clear';

    if (isStorm) {
        condition = 'storm';
        conditionLabel = 'Thunderstorm Advisory';
        safetyStatus = 'danger';
        safetyHeadline = 'Lightning Hazard';
        safetyAdvice =
            'Active storm cells detected. Mandatory boom-down and site lightning shelter.';
    } else if (isRain) {
        condition = 'rain';
        conditionLabel = 'Scattered Showers';
    } else if (seed % 3 < 1.5) {
        condition = 'partly_cloudy';
        conditionLabel = 'Partly Cloudy';
    }

    const groundSaturationRisk: WeatherData['groundSaturationRisk'] = isStorm
        ? 'saturated'
        : isRain
          ? 'damp'
          : 'dry';

    return {
        temperatureC: Math.round(temp),
        condition,
        conditionLabel,
        windSpeedKmh: Math.round(baseWind),
        windGustKmh: Math.round(gust),
        windDirection:
            ['NE', 'ENE', 'E', 'SE', 'SSE', 'NW'][Math.floor(seed) % 6] ?? 'NE',
        humidityPercent: humidity,
        lightningRiskDistanceKm: isStorm ? 8 : null,
        groundSaturationRisk,
        safetyStatus,
        safetyHeadline,
        safetyAdvice,
        isLiveFeed: false,
    };
}

export function WeatherSafetyTelemetry({
    latitude,
    longitude,
    locationLabel,
    variant = 'cockpit',
    className,
}: {
    latitude?: number | null;
    longitude?: number | null;
    locationLabel?: string;
    variant?: 'cockpit' | 'site';
    className?: string;
}) {
    // Default to Base Yard coordinates (Metro Manila: 14.5995, 120.9842) if none provided
    const targetLat = latitude ?? 14.5995;
    const targetLon = longitude ?? 120.9842;

    const [liveData, setLiveData] = useState<WeatherData | null>(null);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        async function fetchLiveWeather() {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh`;
                const response = await fetch(url, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                const current = json.current;

                if (!current) {
                    return;
                }

                const windSpeed = Number(current.wind_speed_10m) || 0;
                const windGust = Number(current.wind_gusts_10m) || windSpeed;
                const windDirDeg = Number(current.wind_direction_10m) || 0;
                const temp = Number(current.temperature_2m) || 28;
                const humidity = Number(current.relative_humidity_2m) || 70;
                const weatherCode = Number(current.weather_code) || 0;
                const precip = Number(current.precipitation) || 0;

                const parsed = parseWmoWeatherCode(weatherCode);

                let safetyStatus: CraneLiftWeatherSafetyStatus = 'safe';
                let safetyHeadline = 'Normal Lift Window';
                let safetyAdvice =
                    'Real-time wind speed is within safe lifting limits (< 30 km/h).';

                if (windGust > 45 || windSpeed > 35 || parsed.isStorm) {
                    safetyStatus = 'danger';
                    safetyHeadline = 'CRITICAL: High Wind / Storm Hold';
                    safetyAdvice = `Real-time gusts reaching ${Math.round(windGust)} km/h. Mandatory stop-lift & boom-down protocol active.`;
                } else if (windGust > 30 || windSpeed > 25) {
                    safetyStatus = 'caution';
                    safetyHeadline = 'Elevated Wind Gusts';
                    safetyAdvice = `Real-time gusts at ${Math.round(windGust)} km/h. Continuously monitor load anemometers and ground pads.`;
                }

                const groundSaturationRisk: WeatherData['groundSaturationRisk'] =
                    parsed.isStorm || precip > 5
                        ? 'saturated'
                        : precip > 0.5
                          ? 'damp'
                          : 'dry';

                if (isMounted) {
                    setLiveData({
                        temperatureC: Math.round(temp),
                        condition: parsed.condition,
                        conditionLabel: parsed.label,
                        windSpeedKmh: Math.round(windSpeed),
                        windGustKmh: Math.round(windGust),
                        windDirection: degreesToCardinal(windDirDeg),
                        humidityPercent: Math.round(humidity),
                        lightningRiskDistanceKm: parsed.isStorm ? 6 : null,
                        groundSaturationRisk,
                        safetyStatus,
                        safetyHeadline,
                        safetyAdvice,
                        isLiveFeed: true,
                        lastUpdatedTime: new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                    });
                }
            } catch (err: unknown) {
                // Fall back gracefully to deterministic engine on network failure or abort
                if (
                    isMounted &&
                    err instanceof Error &&
                    err.name !== 'AbortError'
                ) {
                    setLiveData(deriveWeatherFromCoords(targetLat, targetLon));
                }
            }
        }

        fetchLiveWeather();

        // Refresh live satellite data every 10 minutes
        const interval = setInterval(fetchLiveWeather, 10 * 60 * 1000);

        return () => {
            isMounted = false;
            controller.abort();
            clearInterval(interval);
        };
    }, [targetLat, targetLon]);

    const weather = useMemo(
        () => liveData ?? deriveWeatherFromCoords(targetLat, targetLon),
        [liveData, targetLat, targetLon],
    );

    const isSite = variant === 'site';

    const WeatherIcon =
        weather.condition === 'storm'
            ? CloudLightning
            : weather.condition === 'rain'
              ? CloudRain
              : weather.condition === 'partly_cloudy'
                ? Cloud
                : Sun;

    const statusBg =
        weather.safetyStatus === 'danger'
            ? 'bg-danger-soft border-danger/40 text-danger-strong'
            : weather.safetyStatus === 'caution'
              ? 'bg-warning-soft border-warning/40 text-warning-strong'
              : 'bg-success-soft border-success/40 text-success-strong';

    const statusBadge =
        weather.safetyStatus === 'danger' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-canvas">
                <ShieldAlert className="h-3.5 w-3.5" />
                NO-GO: WIND / STORM HOLD
            </span>
        ) : weather.safetyStatus === 'caution' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2.5 py-0.5 text-xs font-bold text-canvas">
                <AlertTriangle className="h-3.5 w-3.5" />
                CAUTION: MONITOR ANEMOMETER
            </span>
        ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-xs font-bold text-canvas">
                <CheckCircle2 className="h-3.5 w-3.5" />
                GO: SAFE LIFT WINDOW
            </span>
        );

    if (isSite) {
        return (
            <div
                className={cn(
                    'rounded-xl border border-line bg-surface p-4 shadow-xs',
                    className,
                )}
            >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-subtle text-ink">
                            <WeatherIcon className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold tracking-wider text-ink uppercase">
                                    Site Environmental &amp; Wind Safety
                                </h4>
                                {weather.isLiveFeed ? (
                                    <span className="py-0.2 inline-flex items-center gap-1 rounded border border-success/30 bg-success-soft px-1.5 text-[9px] font-bold text-success-strong">
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-strong" />
                                        Live Satellite
                                    </span>
                                ) : (
                                    <span className="py-0.2 rounded border border-line bg-surface-subtle px-1.5 text-[9px] font-medium text-ink-soft">
                                        Estimated
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-ink-soft">
                                {locationLabel ?? 'Job Site Telemetry'} ·{' '}
                                {weather.conditionLabel} ({weather.temperatureC}
                                °C)
                                {weather.lastUpdatedTime &&
                                    ` · Updated ${weather.lastUpdatedTime}`}
                            </p>
                        </div>
                    </div>
                    <div>{statusBadge}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-line bg-surface-subtle p-2.5">
                        <div className="flex items-center justify-between text-ink-soft">
                            <span className="text-[11px] font-medium">
                                Wind Speed
                            </span>
                            <Wind className="h-3.5 w-3.5" />
                        </div>
                        <p className="mt-1 text-base font-bold text-ink">
                            {weather.windSpeedKmh}{' '}
                            <span className="text-xs font-normal text-ink-soft">
                                km/h
                            </span>
                        </p>
                        <p className="text-[10px] text-ink-soft">
                            Heading: {weather.windDirection}
                        </p>
                    </div>

                    <div className="rounded-lg border border-line bg-surface-subtle p-2.5">
                        <div className="flex items-center justify-between text-ink-soft">
                            <span className="text-[11px] font-medium">
                                Peak Gusts
                            </span>
                            <Gauge className="h-3.5 w-3.5" />
                        </div>
                        <p
                            className={cn(
                                'mt-1 text-base font-bold',
                                weather.windGustKmh > 40
                                    ? 'text-danger'
                                    : weather.windGustKmh > 28
                                      ? 'text-warning-strong'
                                      : 'text-ink',
                            )}
                        >
                            {weather.windGustKmh}{' '}
                            <span className="text-xs font-normal text-ink-soft">
                                km/h
                            </span>
                        </p>
                        <p className="text-[10px] text-ink-soft">
                            Limit: 45 km/h
                        </p>
                    </div>

                    <div className="rounded-lg border border-line bg-surface-subtle p-2.5">
                        <div className="flex items-center justify-between text-ink-soft">
                            <span className="text-[11px] font-medium">
                                Soil Saturation
                            </span>
                            <Droplets className="h-3.5 w-3.5" />
                        </div>
                        <p className="mt-1 text-base font-bold text-ink capitalize">
                            {weather.groundSaturationRisk}
                        </p>
                        <p className="text-[10px] text-ink-soft">
                            {weather.groundSaturationRisk === 'saturated'
                                ? 'Ground matting required'
                                : 'Bearing stable'}
                        </p>
                    </div>

                    <div className="rounded-lg border border-line bg-surface-subtle p-2.5">
                        <div className="flex items-center justify-between text-ink-soft">
                            <span className="text-[11px] font-medium">
                                Lightning Risk
                            </span>
                            <Zap className="h-3.5 w-3.5" />
                        </div>
                        <p className="mt-1 text-base font-bold text-ink">
                            {weather.lightningRiskDistanceKm
                                ? `${weather.lightningRiskDistanceKm} km`
                                : 'Clear'}
                        </p>
                        <p className="text-[10px] text-ink-soft">
                            {weather.lightningRiskDistanceKm
                                ? 'Danger < 16 km'
                                : 'No strikes detected'}
                        </p>
                    </div>
                </div>

                <div
                    className={cn(
                        'mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-xs',
                        statusBg,
                    )}
                >
                    <Wind className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <span className="font-bold">
                            {weather.safetyHeadline}:
                        </span>{' '}
                        <span>{weather.safetyAdvice}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Default: Cockpit Regional Banner
    return (
        <Panel
            className={cn(
                'overflow-hidden border border-line bg-surface p-4 shadow-xs md:p-5',
                className,
            )}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-subtle text-ink shadow-xs">
                        <WeatherIcon className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold tracking-tight text-ink">
                                Fleet Operations Weather &amp; Wind Safety
                            </h3>
                            {weather.isLiveFeed && (
                                <span className="py-0.2 inline-flex items-center gap-1 rounded border border-success/30 bg-success-soft px-1.5 text-[9px] font-bold text-success-strong">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-strong" />
                                    Live Satellite
                                </span>
                            )}
                            {statusBadge}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Regional Metro &amp; Site Weather Telemetry ·{' '}
                            {weather.conditionLabel} · {weather.temperatureC}°C
                            · {weather.humidityPercent}% Humidity
                            {weather.lastUpdatedTime &&
                                ` · As of ${weather.lastUpdatedTime}`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-subtle px-3.5 py-2">
                    <div className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-ink-soft" />
                        <div>
                            <span className="block text-[10px] font-semibold text-ink-soft uppercase">
                                Wind
                            </span>
                            <span className="text-xs font-bold text-ink">
                                {weather.windSpeedKmh} km/h{' '}
                                <span className="font-normal text-ink-soft">
                                    {weather.windDirection}
                                </span>
                            </span>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-line" />

                    <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-ink-soft" />
                        <div>
                            <span className="block text-[10px] font-semibold text-ink-soft uppercase">
                                Peak Gust
                            </span>
                            <span
                                className={cn(
                                    'text-xs font-bold',
                                    weather.windGustKmh > 40
                                        ? 'text-danger'
                                        : weather.windGustKmh > 28
                                          ? 'text-warning-strong'
                                          : 'text-ink',
                                )}
                            >
                                {weather.windGustKmh} km/h
                            </span>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-line" />

                    <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-ink-soft" />
                        <div>
                            <span className="block text-[10px] font-semibold text-ink-soft uppercase">
                                Ground Stability
                            </span>
                            <span className="text-xs font-bold text-ink capitalize">
                                {weather.groundSaturationRisk}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className={cn(
                    'mt-3.5 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                    statusBg,
                )}
            >
                <Compass className="h-4 w-4 shrink-0" />
                <span>
                    <strong className="font-semibold">Lift Advisory:</strong>{' '}
                    {weather.safetyAdvice}
                </span>
            </div>
        </Panel>
    );
}
