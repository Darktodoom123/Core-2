<?php

namespace App\Platform\Geocoding\Providers;

use App\Platform\Geocoding\Contracts\ReverseGeocoder;
use App\Platform\Geocoding\Data\PlaceName;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * BigDataCloud free client endpoint. Administrative precision only
 * (barangay / city), so it is the last fallback.
 */
final class BigDataCloudGeocoder implements ReverseGeocoder
{
    public function __construct(private readonly float $timeout) {}

    public function name(): string
    {
        return 'bigdatacloud';
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function reverse(float $latitude, float $longitude): ?PlaceName
    {
        try {
            $response = Http::timeout($this->timeout)
                ->acceptJson()
                ->get('https://api.bigdatacloud.net/data/reverse-geocode-client', [
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'localityLanguage' => 'en',
                ]);

            if (! $response->successful()) {
                return null;
            }

            /** @var array<string, mixed> $json */
            $json = $response->json() ?? [];
            $clean = static fn (mixed $value): ?string => is_string($value) && trim($value) !== ''
                ? (preg_replace('/^City of\s+/i', '', trim($value)) ?? trim($value))
                : null;

            return PlaceName::fromParts(
                [$clean($json['locality'] ?? null)],
                [
                    $clean($json['city'] ?? null),
                    trim(implode(' ', array_filter([$clean($json['principalSubdivision'] ?? null), $clean($json['postcode'] ?? null)]))) ?: null,
                    $clean($json['countryName'] ?? null),
                ],
                $this->name(),
            );
        } catch (\Throwable $exception) {
            Log::info('BigDataCloud reverse geocode error', ['error' => $exception->getMessage()]);

            return null;
        }
    }
}
