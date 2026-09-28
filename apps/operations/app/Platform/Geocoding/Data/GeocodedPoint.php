<?php

namespace App\Platform\Geocoding\Data;

final readonly class GeocodedPoint
{
    public function __construct(
        public float $latitude,
        public float $longitude,
        public PlaceName $place,
    ) {}

    /** @return array{latitude: float, longitude: float, place: array{status: string, primary: string, secondary: string|null, provider: string}} */
    public function toArray(): array
    {
        return [
            'latitude' => round($this->latitude, 7),
            'longitude' => round($this->longitude, 7),
            'place' => [
                'status' => 'resolved',
                'primary' => $this->place->primary,
                'secondary' => $this->place->secondary,
                'provider' => $this->place->provider,
            ],
        ];
    }
}
