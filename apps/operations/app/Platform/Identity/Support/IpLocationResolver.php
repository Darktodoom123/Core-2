<?php

namespace App\Platform\Identity\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

final class IpLocationResolver
{
    /**
     * Known test/anycast IP addresses mapped to deterministic locations
     * for testing and offline development consistency.
     *
     * @var array<string, string>
     */
    private static array $knownLocations = [
        '8.8.8.8' => 'Mountain View, United States',
        '8.8.4.4' => 'Mountain View, United States',
        '1.1.1.1' => 'Sydney, Australia',
        '1.0.0.1' => 'Sydney, Australia',
        '9.9.9.9' => 'Berkeley, United States',
        '208.67.222.222' => 'San Francisco, United States',
        '208.67.220.220' => 'San Francisco, United States',
    ];

    /**
     * Custom mock resolver or overrides for testing.
     *
     * @var array<string, string>
     */
    private static array $customOverrides = [];

    /**
     * Set a mock location override for testing.
     */
    public static function setOverride(string $ip, string $location): void
    {
        self::$customOverrides[$ip] = $location;
    }

    /**
     * Clear mock overrides.
     */
    public static function clearOverrides(): void
    {
        self::$customOverrides = [];
    }

    /**
     * Clean and normalize raw IP input (trim, strip proxy chains, strip ports, unwrap IPv4-mapped IPv6).
     */
    public static function normalizeIp(?string $ip): ?string
    {
        if (empty($ip) || $ip === 'Unknown IP') {
            return null;
        }

        $ip = trim($ip);

        // If multiple comma-separated IPs (e.g. from X-Forwarded-For), take the first client IP
        if (str_contains($ip, ',')) {
            $ip = trim(explode(',', $ip)[0]);
        }

        // If bracketed IPv6 with port e.g. [::1]:8080
        if (preg_match('/^\[([a-f0-9:]+)\](?::\d+)?$/i', $ip, $matches)) {
            $ip = $matches[1];
        } elseif (preg_match('/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/', $ip, $matches)) {
            // IPv4 with port e.g. 192.168.1.1:8080
            $ip = $matches[1];
        }

        // Handle IPv4-mapped IPv6 addresses like ::ffff:192.168.1.1 or ::ffff:8.8.8.8
        if (preg_match('/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i', $ip, $matches)) {
            $ip = $matches[1];
        }

        return $ip;
    }

    /**
     * Resolve an IP address into a human-readable approximate location label.
     */
    public static function resolve(?string $ip): string
    {
        $normalized = self::normalizeIp($ip);
        if ($normalized === null) {
            return 'Unknown Location';
        }

        if (isset(self::$customOverrides[$normalized])) {
            return self::$customOverrides[$normalized];
        }

        // Loopback addresses
        if ($normalized === '127.0.0.1' || $normalized === '::1' || $normalized === 'localhost' || str_starts_with($normalized, '127.')) {
            return 'Local Machine (Loopback)';
        }

        // MUST be a valid IP address! An invalid string should never be considered a valid location or private network
        if (! filter_var($normalized, FILTER_VALIDATE_IP)) {
            return 'Unknown Location';
        }

        // Check if IP is private or link-local or reserved
        if (! filter_var($normalized, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            if (str_starts_with($normalized, '169.254.') || str_starts_with(strtolower($normalized), 'fe80:')) {
                return 'Local Network / Link-Local';
            }

            return 'Local Network / Private IP';
        }

        // Check well-known static IPs
        if (isset(self::$knownLocations[$normalized])) {
            return self::$knownLocations[$normalized];
        }

        // Check proxy/CDN geolocation headers from current request if IP matches
        try {
            $request = request();
            if (self::normalizeIp($request->ip()) === $normalized) {
                $city = $request->header('CF-IPCity')
                    ?? $request->header('X-Geo-City')
                    ?? $request->header('CloudFront-Viewer-City');
                $country = $request->header('CF-IPCountry')
                    ?? $request->header('X-Geo-Country')
                    ?? $request->header('CloudFront-Viewer-Country-Name')
                    ?? $request->header('X-Country-Code');

                if (is_string($city)) {
                    $city = trim(rawurldecode($city));
                }
                if (is_string($country)) {
                    $country = trim((string) $country);
                }

                if (! empty($city) && ! empty($country)) {
                    return "{$city}, {$country}";
                }
                if (! empty($country)) {
                    return (string) $country;
                }
            }
        } catch (Throwable) {
            // request() might not be available in all contexts
        }

        // In test environments or when running unit tests, do NOT make external HTTP calls
        $isTesting = false;
        try {
            if (function_exists('app') && app()->has('env')) {
                $isTesting = app()->runningUnitTests() || app()->environment('testing');
            } elseif (defined('PHPUNIT_COMPOSER_INSTALL') || defined('__PHPUNIT_PHAR__')) {
                $isTesting = true;
            }
        } catch (Throwable) {
            $isTesting = true;
        }

        if ($isTesting) {
            return 'Unknown Location';
        }

        // In production/local environments, resolve via cache and lightweight fallback
        return Cache::remember("ip_location:{$normalized}", now()->addDays(30), function () use ($normalized): string {
            try {
                $response = Http::timeout(1.5)
                    ->acceptJson()
                    ->get("http://ip-api.com/json/{$normalized}", [
                        'fields' => 'status,message,country,city,regionName',
                    ]);

                if ($response->successful() && $response->json('status') === 'success') {
                    $city = (string) ($response->json('city') ?? '');
                    $country = (string) ($response->json('country') ?? '');
                    $region = (string) ($response->json('regionName') ?? '');

                    if ($city !== '' && $country !== '') {
                        return "{$city}, {$country}";
                    }
                    if ($region !== '' && $country !== '') {
                        return "{$region}, {$country}";
                    }
                    if ($country !== '') {
                        return $country;
                    }
                }
            } catch (Throwable) {
                // Network failure or timeout - safely ignore
            }

            return 'Unknown Location';
        });
    }

    /**
     * Check whether an IP represents a local, loopback, or private address.
     */
    public static function isLocalOrPrivate(?string $ip): bool
    {
        $normalized = self::normalizeIp($ip);
        if ($normalized === null) {
            return false;
        }

        if ($normalized === '127.0.0.1' || $normalized === '::1' || $normalized === 'localhost' || str_starts_with($normalized, '127.')) {
            return true;
        }

        // Must be a valid IP address
        if (! filter_var($normalized, FILTER_VALIDATE_IP)) {
            return false;
        }

        return ! filter_var($normalized, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }
}
