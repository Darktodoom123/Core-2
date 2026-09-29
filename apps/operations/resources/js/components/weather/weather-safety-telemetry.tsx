import { AlertTriangle, Cloud, RefreshCw, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LocationLabel } from '@/components/location/location-label';
import { FOCHUN_WAREHOUSE } from '@/components/maplibre/warehouse-location';
import { Panel } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { LocationUpdateViewModel } from '@/types/workspace';

interface WeatherObservation {
    temperatureC: number;
    humidityPercent: number;
    windSpeedKmh: number;
    windGustKmh: number;
    windDirection: number;
    conditionCode: number;
    observedAt: string;
}

function numberField(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseObservation(value: unknown): WeatherObservation | null {
    if (typeof value !== 'object' || value === null || !('current' in value)) {
        return null;
    }

    const current = value.current;

    if (typeof current !== 'object' || current === null) {
        return null;
    }

    const fields = current as Record<string, unknown>;
    const temperatureC = numberField(fields.temperature_2m);
    const humidityPercent = numberField(fields.relative_humidity_2m);
    const windSpeedKmh = numberField(fields.wind_speed_10m);
    const windGustKmh = numberField(fields.wind_gusts_10m);
    const windDirection = numberField(fields.wind_direction_10m);
    const conditionCode = numberField(fields.weather_code);
    const observedAt = fields.time;

    if (
        temperatureC === null ||
        humidityPercent === null ||
        windSpeedKmh === null ||
        windGustKmh === null ||
        windDirection === null ||
        conditionCode === null ||
        typeof observedAt !== 'string'
    ) {
        return null;
    }

    return {
        temperatureC,
        humidityPercent,
        windSpeedKmh,
        windGustKmh,
        windDirection,
        conditionCode,
        observedAt,
    };
}

function weatherCondition(code: number): string {
    if (code >= 95) {
        return 'Thunderstorm forecast';
    }

    if (code >= 51) {
        return 'Precipitation forecast';
    }

    if (code >= 45) {
        return 'Fog forecast';
    }

    if (code >= 1) {
        return 'Cloud cover';
    }

    return 'Clear forecast';
}

export function WeatherSafetyTelemetry({
    latitude,
    longitude,
    locationLabel,
    variant = 'cockpit',
    className,
    availableLocations,
    selectedLocationId,
    onSelectLocationId,
}: {
    latitude?: number | null;
    longitude?: number | null;
    locationLabel?: string;
    variant?: 'cockpit' | 'site' | 'tracking';
    className?: string;
    availableLocations?: LocationUpdateViewModel[];
    selectedLocationId?: number | null;
    onSelectLocationId?: (id: number | null) => void;
}) {
    const isSite = variant === 'site';
    const hasSiteCoordinates = latitude != null && longitude != null;
    // With no unit selected, the fleet view reports weather at the company
    // yard (a real, fixed facility) and says so.
    const usesYard = !isSite && (latitude == null || longitude == null);
    const targetLat = usesYard ? FOCHUN_WAREHOUSE.position[1] : latitude;
    const targetLon = usesYard ? FOCHUN_WAREHOUSE.position[0] : longitude;
    const key = `${targetLat ?? 'none'}:${targetLon ?? 'none'}`;
    const [result, setResult] = useState<{
        key: string;
        observation: WeatherObservation | null;
    } | null>(null);
    const observation = result?.key === key ? result.observation : null;
    const state =
        result?.key === key
            ? observation
                ? 'ready'
                : 'unavailable'
            : 'loading';

    useEffect(() => {
        if (targetLat == null || targetLon == null) {
            return;
        }

        const controller = new AbortController();
        let active = true;
        const fetchWeather = async () => {
            try {
                const params = new URLSearchParams({
                    latitude: String(targetLat),
                    longitude: String(targetLon),
                    current:
                        'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
                    wind_speed_unit: 'kmh',
                    timezone: 'Asia/Manila',
                });
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?${params}`,
                    {
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    throw new Error('Weather provider unavailable');
                }

                const parsed = parseObservation(await response.json());

                if (!parsed) {
                    throw new Error('Weather observation incomplete');
                }

                if (active) {
                    setResult({ key, observation: parsed });
                }
            } catch (error) {
                if (
                    active &&
                    !(
                        error instanceof DOMException &&
                        error.name === 'AbortError'
                    )
                ) {
                    setResult({ key, observation: null });
                }
            }
        };
        void fetchWeather();
        const interval = window.setInterval(
            () => void fetchWeather(),
            10 * 60 * 1000,
        );

        return () => {
            active = false;
            controller.abort();
            window.clearInterval(interval);
        };
    }, [key, targetLat, targetLon]);

    const location = usesYard
        ? FOCHUN_WAREHOUSE.label
        : (locationLabel ?? (isSite ? 'Job site' : null));
    const locationControl =
        variant === 'tracking' && availableLocations?.length ? (
            <label className="flex items-center gap-2 text-xs text-ink-soft">
                Target
                <select
                    aria-label="Target asset or site for weather monitoring"
                    value={selectedLocationId ?? ''}
                    onChange={(event) =>
                        onSelectLocationId?.(
                            event.target.value
                                ? Number(event.target.value)
                                : null,
                        )
                    }
                    className="min-h-9 rounded-md border border-line bg-surface px-2 text-ink focus-visible:ring-2 focus-visible:ring-brand-strong"
                >
                    <option value="">Base Yard (Metro Manila)</option>
                    {availableLocations.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.asset?.name ??
                                item.asset?.code ??
                                item.user.name}
                            {item.job?.site ? ` (${item.job.site})` : ''}
                        </option>
                    ))}
                </select>
            </label>
        ) : null;

    const content = (
        <div
            className="space-y-3"
            role="group"
            aria-label="Weather observation"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                    <Cloud
                        className="mt-0.5 size-5 text-brand-strong"
                        aria-hidden="true"
                    />
                    <div>
                        <h3 className="font-semibold text-ink">
                            {isSite ? 'Site weather' : 'Weather and wind'}
                        </h3>
                        <div className="flex flex-wrap items-start gap-x-1.5 text-xs text-ink-soft">
                            {location && (
                                <span className="font-medium text-ink">
                                    {location} ·
                                </span>
                            )}
                            <LocationLabel
                                latitude={targetLat}
                                longitude={targetLon}
                                variant="inline"
                                showIcon={!location}
                                emptyLabel="Coordinates not recorded"
                            />
                        </div>
                    </div>
                </div>
                {locationControl}
            </div>

            {isSite && !hasSiteCoordinates ? (
                <p
                    className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning-strong"
                    role="status"
                >
                    <AlertTriangle
                        className="size-4 shrink-0"
                        aria-hidden="true"
                    />
                    Site weather unavailable because coordinates not recorded.
                    Pin the job site coordinates to request a forecast.
                </p>
            ) : state === 'loading' ? (
                <p
                    className="flex items-center gap-2 text-sm text-ink-soft"
                    role="status"
                >
                    <RefreshCw
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                    />
                    Loading Open-Meteo weather for these coordinates…
                </p>
            ) : state === 'unavailable' || !observation ? (
                <p
                    className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning-strong"
                    role="status"
                >
                    Open-Meteo weather is unavailable. Check site conditions
                    through an approved source before work.
                </p>
            ) : (
                <>
                    <p className="text-xs text-ink-soft">
                        Open-Meteo current model conditions · observation{' '}
                        {observation.observedAt} PHT
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <p className="text-xs text-ink-soft">Conditions</p>
                            <p className="font-semibold text-ink">
                                {weatherCondition(observation.conditionCode)} ·{' '}
                                {Math.round(observation.temperatureC)}°C
                            </p>
                            <p className="text-xs text-ink-soft">
                                {Math.round(observation.humidityPercent)}%
                                humidity
                            </p>
                        </div>
                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <p className="flex items-center gap-1 text-xs text-ink-soft">
                                <Wind className="size-3" aria-hidden="true" />{' '}
                                Wind
                            </p>
                            <p className="font-semibold text-ink">
                                {Math.round(observation.windSpeedKmh)} km/h
                            </p>
                            <p className="text-xs text-ink-soft">
                                Direction{' '}
                                {Math.round(observation.windDirection)}°
                            </p>
                        </div>
                        <div className="rounded-lg border border-line bg-surface-subtle p-3">
                            <p className="text-xs text-ink-soft">Gusts</p>
                            <p className="font-semibold text-ink">
                                {Math.round(observation.windGustKmh)} km/h
                            </p>
                        </div>
                    </div>
                </>
            )}
            <p className="text-xs text-ink-soft">
                Weather data does not establish ground bearing, lightning
                distance, or lift clearance. Check on-site measurements and
                operating conditions.
            </p>
        </div>
    );

    return variant === 'cockpit' ? (
        <Panel className={cn('border border-line bg-surface p-4', className)}>
            {content}
        </Panel>
    ) : (
        <div
            className={cn(
                'rounded-xl border border-line bg-surface p-4',
                className,
            )}
        >
            {content}
        </div>
    );
}
