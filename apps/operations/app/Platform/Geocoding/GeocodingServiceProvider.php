<?php

namespace App\Platform\Geocoding;

use App\Platform\Geocoding\Providers\BigDataCloudGeocoder;
use App\Platform\Geocoding\Providers\PhotonGeocoder;
use App\Platform\Geocoding\Providers\StadiaGeocoder;
use App\Platform\Geocoding\Services\PlaceNameResolver;
use Illuminate\Support\ServiceProvider;

final class GeocodingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PlaceNameResolver::class, function (): PlaceNameResolver {
            /** @var array{providers?: list<string>, timeout?: float, retry_after_minutes?: int, stadia_key?: string|null, search_country?: string|null} $config */
            $config = (array) config('services.geocoding', []);
            $timeout = (float) ($config['timeout'] ?? 4.0);

            $available = [
                'stadia' => new StadiaGeocoder($config['stadia_key'] ?? null, $timeout),
                'photon' => new PhotonGeocoder($timeout),
                'bigdatacloud' => new BigDataCloudGeocoder($timeout),
            ];
            $order = $config['providers'] ?? ['stadia', 'photon', 'bigdatacloud'];
            $enabled = array_values(array_filter(
                array_map(static fn (string $name) => $available[$name] ?? null, $order),
            ));

            return new PlaceNameResolver(
                providers: $enabled,
                retryAfterMinutes: (int) ($config['retry_after_minutes'] ?? 15),
                // BigDataCloud has no address search; Stadia and Photon do.
                searchProviders: array_values(array_filter(
                    $enabled,
                    static fn ($provider): bool => ! $provider instanceof BigDataCloudGeocoder,
                )),
                searchCountry: ($config['search_country'] ?? null) ?: null,
            );
        });
    }
}
