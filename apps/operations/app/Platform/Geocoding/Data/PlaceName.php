<?php

namespace App\Platform\Geocoding\Data;

/**
 * The nearest mapped address for a coordinate: a headline (landmark or
 * street) and the surrounding area. Never contains a coordinate string.
 */
final readonly class PlaceName
{
    public function __construct(
        public string $primary,
        public ?string $secondary,
        public string $provider,
    ) {}

    /**
     * Build from raw parts, dropping blanks and case-insensitive duplicates
     * (providers often repeat the city as locality and county).
     *
     * @param  list<string|null>  $primaryParts
     * @param  list<string|null>  $areaParts
     */
    public static function fromParts(array $primaryParts, array $areaParts, string $provider): ?self
    {
        $seen = [];
        $clean = static function (array $parts) use (&$seen): array {
            $out = [];

            foreach ($parts as $part) {
                $value = trim((string) $part);
                $normalised = mb_strtolower($value);

                if ($value === '' || isset($seen[$normalised])) {
                    continue;
                }

                $seen[$normalised] = true;
                $out[] = $value;
            }

            return $out;
        };

        $primary = $clean($primaryParts);
        $area = $clean($areaParts);

        if ($primary === [] && $area === []) {
            return null;
        }

        if ($primary === []) {
            $primary = [array_shift($area)];
        }

        return new self(
            implode(', ', $primary),
            $area === [] ? null : implode(', ', $area),
            $provider,
        );
    }
}
