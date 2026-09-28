<?php

namespace App\Platform\Geocoding\Contracts;

use App\Platform\Geocoding\Data\PlaceName;

interface ReverseGeocoder
{
    /** Short provider id stored with each cached place, e.g. "stadia". */
    public function name(): string;

    /** Whether the provider is configured (for example, has an API key). */
    public function isAvailable(): bool;

    /**
     * Nearest address for the point, or null when the provider has none or
     * cannot be reached. Must never throw.
     */
    public function reverse(float $latitude, float $longitude): ?PlaceName;
}
