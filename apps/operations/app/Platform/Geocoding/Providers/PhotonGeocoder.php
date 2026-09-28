<?php

namespace App\Platform\Geocoding\Providers;

use App\Platform\Geocoding\Contracts\ForwardGeocoder;
use App\Platform\Geocoding\Contracts\ReverseGeocoder;
use App\Platform\Geocoding\Data\GeocodedPoint;
use App\Platform\Geocoding\Data\PlaceName;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** Photon (komoot), OpenStreetMap data. No key required; fair-use limits apply. */
final class PhotonGeocoder implements ForwardGeocoder, ReverseGeocoder
{
    public function __construct(private readonly float $timeout) {}

    public function name(): string
    {
        return 'photon';
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function reverse(float $latitude, float $longitude): ?PlaceName
    {
        $features = $this->features('https://photon.komoot.io/reverse', [
            'lat' => $latitude,
            'lon' => $longitude,
        ]);

        return isset($features[0]) ? $this->placeFrom($features[0]['properties'] ?? []) : null;
    }

    public function search(string $query, ?string $countryCode): ?GeocodedPoint
    {
        // Photon has no country filter, so take the first match in-country.
        foreach ($this->features('https://photon.komoot.io/api/', ['q' => $query, 'limit' => 5]) as $feature) {
            $properties = $feature['properties'] ?? [];
            $coordinates = $feature['geometry']['coordinates'] ?? null;

            if ($countryCode !== null && strcasecmp((string) ($properties['countrycode'] ?? ''), $countryCode) !== 0) {
                continue;
            }

            $place = $this->placeFrom($properties);

            if ($place !== null && is_array($coordinates) && count($coordinates) >= 2) {
                return new GeocodedPoint((float) $coordinates[1], (float) $coordinates[0], $place);
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return list<array<string, mixed>>
     */
    private function features(string $url, array $query): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->acceptJson()
                ->withUserAgent('Core2-Operations/1.0 (geocoding)')
                ->get($url, $query + ['lang' => 'en']);

            if (! $response->successful()) {
                return [];
            }

            $features = $response->json('features');

            return is_array($features) ? array_values(array_filter($features, 'is_array')) : [];
        } catch (\Throwable $exception) {
            Log::info('Photon geocoding error', ['error' => $exception->getMessage()]);

            return [];
        }
    }

    /** @param  array<string, mixed>  $p */
    private function placeFrom(array $p): ?PlaceName
    {
        if ($p === []) {
            return null;
        }

        $street = trim(implode(' ', array_filter([$p['housenumber'] ?? null, $p['street'] ?? null])));
        $city = $p['city'] ?? $p['county'] ?? null;
        $name = $p['name'] ?? null;

        return PlaceName::fromParts(
            [
                $name !== null && mb_strtolower((string) $name) !== mb_strtolower((string) $city) ? $name : null,
                $street !== '' ? $street : null,
            ],
            [
                $p['locality'] ?? null,
                $p['district'] ?? null,
                $city,
                trim(implode(' ', array_filter([$p['state'] ?? null, $p['postcode'] ?? null]))) ?: null,
                $p['country'] ?? null,
            ],
            $this->name(),
        );
    }
}
