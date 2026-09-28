<?php

namespace App\Platform\Geocoding\Contracts;

use App\Platform\Geocoding\Data\GeocodedPoint;

interface ForwardGeocoder
{
    public function name(): string;

    public function isAvailable(): bool;

    /**
     * Best match for a free-text address, optionally limited to an ISO
     * 3166-1 alpha-2 country. Null when nothing matches. Must never throw.
     */
    public function search(string $query, ?string $countryCode): ?GeocodedPoint;
}
