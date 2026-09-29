<?php

namespace App\Platform\Geocoding\Services;

use App\Platform\Geocoding\Contracts\ForwardGeocoder;
use App\Platform\Geocoding\Contracts\ReverseGeocoder;
use App\Platform\Geocoding\Data\PlaceName;
use App\Platform\Geocoding\Jobs\ResolvePlaceNameJob;
use App\Platform\Geocoding\Models\GeocodedPlace;
use Illuminate\Support\Facades\Cache;

/**
 * Turns coordinates into the nearest mapped address, trying each configured
 * provider in order (Stadia, then Photon, then BigDataCloud) and caching the
 * first answer. It never invents a name: when every provider fails the place
 * is reported as unavailable.
 *
 * The array shape returned by describe()/resolveNow() is what web and mobile
 * receive as `place`:
 *   status: resolved | pending | unavailable
 *   primary / secondary: address lines, null unless resolved
 *   provider: which service named it, null unless resolved
 */
final class PlaceNameResolver
{
    /**
     * @param  list<ReverseGeocoder>  $providers
     * @param  list<ForwardGeocoder>  $searchProviders
     */
    public function __construct(
        private readonly array $providers,
        private readonly int $retryAfterMinutes = 15,
        private readonly array $searchProviders = [],
        private readonly ?string $searchCountry = null,
    ) {}

    /**
     * Find coordinates for a typed address (Stadia, then Photon). Results are
     * cached for a day. Null when nothing matches; no default is ever returned.
     *
     * @return array{latitude: float, longitude: float, place: array<string, mixed>}|null
     */
    public function search(string $query): ?array
    {
        $query = trim(preg_replace('/\s+/', ' ', $query) ?? '');

        if ($query === '') {
            return null;
        }

        $cacheKey = 'geocoding:search:'.sha1(mb_strtolower($query).'|'.$this->searchCountry);
        $cached = Cache::get($cacheKey);

        if (is_array($cached)
            && is_numeric($cached['latitude'] ?? null)
            && is_numeric($cached['longitude'] ?? null)
            && is_array($cached['place'] ?? null)) {
            /** @var array<string, mixed> $place */
            $place = $cached['place'];

            return [
                'latitude' => (float) $cached['latitude'],
                'longitude' => (float) $cached['longitude'],
                'place' => $place,
            ];
        }

        foreach ($this->searchProviders as $provider) {
            if (! $provider->isAvailable()) {
                continue;
            }

            $point = $provider->search($query, $this->searchCountry);

            if ($point !== null) {
                $result = $point->toArray();
                Cache::put($cacheKey, $result, now()->addDay());

                return $result;
            }
        }

        return null;
    }

    public static function key(float $latitude, float $longitude): string
    {
        return sprintf('%.5f,%.5f', round($latitude, 5), round($longitude, 5));
    }

    /**
     * Cache-only lookup for rendering. A miss queues a background lookup and
     * reports "pending"; nothing here waits on the network.
     *
     * @return array{status: string, primary: string|null, secondary: string|null, provider: string|null}|null
     */
    public function describe(mixed $latitude, mixed $longitude): ?array
    {
        if (! self::isCoordinate($latitude, $longitude)) {
            return null;
        }

        $key = self::key((float) $latitude, (float) $longitude);

        return $this->present(
            GeocodedPlace::query()->where('coordinate_key', $key)->first(),
            (float) $latitude,
            (float) $longitude,
        );
    }

    /**
     * Batched describe() for lists (map units, queues). One query for all.
     *
     * @param  iterable<array{0: mixed, 1: mixed}>  $points
     * @return array<string, array{status: string, primary: string|null, secondary: string|null, provider: string|null}>
     */
    public function describeMany(iterable $points): array
    {
        $wanted = [];

        foreach ($points as [$latitude, $longitude]) {
            if (self::isCoordinate($latitude, $longitude)) {
                $wanted[self::key((float) $latitude, (float) $longitude)] = [(float) $latitude, (float) $longitude];
            }
        }

        if ($wanted === []) {
            return [];
        }

        $rows = GeocodedPlace::query()
            ->whereIn('coordinate_key', array_keys($wanted))
            ->get()
            ->keyBy('coordinate_key');

        $described = [];

        foreach ($wanted as $key => [$latitude, $longitude]) {
            $described[$key] = $this->present($rows->get($key), $latitude, $longitude);
        }

        return $described;
    }

    /**
     * Resolve now, calling providers on a cache miss. Used by the lookup
     * endpoint and the background job.
     *
     * @return array{status: string, primary: string|null, secondary: string|null, provider: string|null}
     */
    public function resolveNow(float $latitude, float $longitude): array
    {
        $key = self::key($latitude, $longitude);
        $row = GeocodedPlace::query()->where('coordinate_key', $key)->first();

        if ($row?->resolved_at !== null || $this->recentlyFailed($row)) {
            return $this->toView($row);
        }

        $place = $this->queryProviders($latitude, $longitude);

        $row = GeocodedPlace::query()->updateOrCreate(
            ['coordinate_key' => $key],
            [
                'latitude' => round($latitude, 5),
                'longitude' => round($longitude, 5),
                'primary_name' => $place?->primary,
                'secondary_name' => $place?->secondary,
                'provider' => $place?->provider,
                'resolved_at' => $place !== null ? now() : null,
                'failed_at' => $place === null ? now() : null,
            ],
        );

        return $this->toView($row);
    }

    private function queryProviders(float $latitude, float $longitude): ?PlaceName
    {
        foreach ($this->providers as $provider) {
            if (! $provider->isAvailable()) {
                continue;
            }

            $place = $provider->reverse($latitude, $longitude);

            if ($place !== null) {
                return $place;
            }
        }

        return null;
    }

    /**
     * @return array{status: string, primary: string|null, secondary: string|null, provider: string|null}
     */
    private function present(?GeocodedPlace $row, float $latitude, float $longitude): array
    {
        if ($row?->resolved_at !== null || $this->recentlyFailed($row)) {
            return $this->toView($row);
        }

        $key = self::key($latitude, $longitude);

        // One queued lookup per coordinate at a time.
        if (Cache::add("geocoding:queued:{$key}", true, now()->addMinutes(2))) {
            ResolvePlaceNameJob::dispatch($latitude, $longitude);
        }

        return ['status' => 'pending', 'primary' => null, 'secondary' => null, 'provider' => null];
    }

    private function recentlyFailed(?GeocodedPlace $row): bool
    {
        return $row !== null
            && $row->resolved_at === null
            && $row->failed_at !== null
            && $row->failed_at->gt(now()->subMinutes($this->retryAfterMinutes));
    }

    /**
     * @return array{status: string, primary: string|null, secondary: string|null, provider: string|null}
     */
    private function toView(?GeocodedPlace $row): array
    {
        if ($row?->resolved_at !== null && $row->primary_name !== null) {
            return [
                'status' => 'resolved',
                'primary' => $row->primary_name,
                'secondary' => $row->secondary_name,
                'provider' => $row->provider,
            ];
        }

        return ['status' => 'unavailable', 'primary' => null, 'secondary' => null, 'provider' => null];
    }

    private static function isCoordinate(mixed $latitude, mixed $longitude): bool
    {
        return is_numeric($latitude) && is_numeric($longitude)
            && (float) $latitude >= -90 && (float) $latitude <= 90
            && (float) $longitude >= -180 && (float) $longitude <= 180;
    }
}
