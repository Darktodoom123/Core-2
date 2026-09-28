<?php

namespace App\Platform\Geocoding\Providers;

use App\Platform\Geocoding\Contracts\ForwardGeocoder;
use App\Platform\Geocoding\Contracts\ReverseGeocoder;
use App\Platform\Geocoding\Data\GeocodedPoint;
use App\Platform\Geocoding\Data\PlaceName;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Stadia Maps geocoding (Pelias). Server-side calls need an API key; without
 * one the provider reports itself unavailable and is skipped.
 */
final class StadiaGeocoder implements ForwardGeocoder, ReverseGeocoder
{
    private const BASE_URL = 'https://api.stadiamaps.com/geocoding/v1';

    public function __construct(
        private readonly ?string $apiKey,
        private readonly float $timeout,
    ) {}

    public function name(): string
    {
        return 'stadia';
    }

    public function isAvailable(): bool
    {
        return is_string($this->apiKey) && trim($this->apiKey) !== '';
    }

    public function reverse(float $latitude, float $longitude): ?PlaceName
    {
        $feature = $this->firstFeature('/reverse', [
            'point.lat' => $latitude,
            'point.lon' => $longitude,
            'size' => 1,
        ]);

        return $feature === null ? null : $this->placeFrom($feature['properties'] ?? []);
    }

    public function search(string $query, ?string $countryCode): ?GeocodedPoint
    {
        $feature = $this->firstFeature('/search', array_filter([
            'text' => $query,
            'size' => 1,
            'boundary.country' => $countryCode,
        ]));
        $coordinates = $feature['geometry']['coordinates'] ?? null;
        $place = $feature === null ? null : $this->placeFrom($feature['properties'] ?? []);

        if (! is_array($coordinates) || count($coordinates) < 2 || $place === null) {
            return null;
        }

        return new GeocodedPoint((float) $coordinates[1], (float) $coordinates[0], $place);
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    private function firstFeature(string $path, array $query): ?array
    {
        if (! $this->isAvailable()) {
            return null;
        }

        try {
            $response = Http::timeout($this->timeout)
                ->acceptJson()
                ->get(self::BASE_URL.$path, $query + ['lang' => 'en', 'api_key' => $this->apiKey]);

            if (! $response->successful()) {
                Log::info('Stadia geocoding failed', ['path' => $path, 'status' => $response->status()]);

                return null;
            }

            $feature = $response->json('features.0');

            return is_array($feature) ? $feature : null;
        } catch (\Throwable $exception) {
            Log::info('Stadia geocoding error', ['path' => $path, 'error' => $exception->getMessage()]);

            return null;
        }
    }

    /** @param  array<string, mixed>  $p */
    private function placeFrom(array $p): ?PlaceName
    {
        if ($p === []) {
            return null;
        }

        $street = trim(implode(' ', array_filter([$p['housenumber'] ?? null, $p['street'] ?? null])));

        return PlaceName::fromParts(
            [$p['name'] ?? null, $street !== '' ? $street : null],
            [
                $p['neighbourhood'] ?? null,
                $p['locality'] ?? null,
                $p['localadmin'] ?? null,
                $p['county'] ?? null,
                trim(implode(' ', array_filter([$p['region'] ?? null, $p['postalcode'] ?? null]))) ?: null,
                $p['country'] ?? null,
            ],
            $this->name(),
        );
    }
}
