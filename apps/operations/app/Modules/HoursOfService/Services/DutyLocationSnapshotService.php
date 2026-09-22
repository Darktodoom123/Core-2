<?php

namespace App\Modules\HoursOfService\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

final class DutyLocationSnapshotService
{
    /**
     * Resolve and validate the location that arrived with a duty event.
     *
     * The returned values are persisted on the duty log. This method never
     * looks up an asset's latest tracking point, so delayed replay cannot
     * replace the event's original observation.
     *
     * @return array{
     *     latitude: float|null,
     *     longitude: float|null,
     *     accuracy_metres: float|null,
     *     location_observed_at: Carbon|null,
     *     location_source: string,
     *     location_freshness: string
     * }
     */
    public function resolve(
        ?float $latitude,
        ?float $longitude,
        ?float $accuracyMetres,
        ?CarbonInterface $observedAt,
        ?string $source,
        CarbonInterface $occurredAt,
        CarbonInterface $acceptedAt,
    ): array {
        $hasLatitude = $latitude !== null;
        $hasLongitude = $longitude !== null;

        if ($hasLatitude !== $hasLongitude) {
            throw ValidationException::withMessages([
                'latitude' => 'Latitude and longitude must be supplied together.',
                'longitude' => 'Latitude and longitude must be supplied together.',
            ]);
        }

        if (! $hasLatitude && ! $hasLongitude) {
            if ($observedAt !== null || $accuracyMetres !== null) {
                throw ValidationException::withMessages([
                    'location_observed_at' => 'A location observation timestamp and accuracy require coordinates.',
                    'accuracy_metres' => 'A location observation timestamp and accuracy require coordinates.',
                ]);
            }

            $unavailableSource = in_array($source, ['permission_denied', 'retention_pruned', 'legacy'], true)
                ? $source
                : 'unavailable';

            return [
                'latitude' => null,
                'longitude' => null,
                'accuracy_metres' => null,
                'location_observed_at' => null,
                'location_source' => $unavailableSource,
                'location_freshness' => 'unavailable',
            ];
        }

        if (! is_finite($latitude) || $latitude < -90 || $latitude > 90) {
            throw ValidationException::withMessages([
                'latitude' => 'The latitude must be between -90 and 90.',
            ]);
        }

        if (! is_finite($longitude) || $longitude < -180 || $longitude > 180) {
            throw ValidationException::withMessages([
                'longitude' => 'The longitude must be between -180 and 180.',
            ]);
        }

        if ($accuracyMetres !== null && (! is_finite($accuracyMetres) || $accuracyMetres < 0 || $accuracyMetres > 10_000)) {
            throw ValidationException::withMessages([
                'accuracy_metres' => 'The location accuracy must be between 0 and 10,000 metres.',
            ]);
        }

        $observed = $observedAt !== null ? Carbon::instance($observedAt) : Carbon::instance($occurredAt);
        $maximumFutureTime = Carbon::instance($acceptedAt)->addSeconds((int) config('hours_of_service.location_max_future_skew_seconds', 300));

        if ($observed->gt($maximumFutureTime)) {
            throw ValidationException::withMessages([
                'location_observed_at' => 'The location observation cannot be materially in the future.',
            ]);
        }

        $maximumEventSkew = Carbon::instance($occurredAt)->addSeconds((int) config('hours_of_service.location_max_future_skew_seconds', 300));

        if ($observed->gt($maximumEventSkew)) {
            throw ValidationException::withMessages([
                'location_observed_at' => 'The location observation must be at or near the duty event time.',
            ]);
        }

        $normalisedSource = $source ?: 'gps';
        $allowedSources = [
            'gps',
            'last_known',
            'browser_gps',
            'legacy',
            'retention_pruned',
        ];

        if (! in_array($normalisedSource, $allowedSources, true)) {
            throw ValidationException::withMessages([
                'location_source' => 'The location source is not supported.',
            ]);
        }

        $ageSeconds = abs(Carbon::instance($occurredAt)->diffInSeconds($observed));
        $isFreshSource = in_array($normalisedSource, ['gps', 'browser_gps'], true);
        $freshness = $isFreshSource && $ageSeconds <= (int) config('hours_of_service.location_fresh_after_seconds', 180)
            ? 'fresh'
            : 'last_known';

        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy_metres' => $accuracyMetres,
            'location_observed_at' => $observed,
            'location_source' => $normalisedSource,
            'location_freshness' => $freshness,
        ];
    }
}
