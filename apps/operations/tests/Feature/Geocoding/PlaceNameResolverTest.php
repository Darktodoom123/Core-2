<?php

use App\Platform\Geocoding\Models\GeocodedPlace;
use App\Platform\Geocoding\Services\PlaceNameResolver;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

const STADIA_URL = 'api.stadiamaps.com/*';
const PHOTON_URL = 'photon.komoot.io/*';
const BDC_URL = 'api.bigdatacloud.net/*';

/** Rebuild the resolver with every provider enabled (tests default to none). */
function enableGeocoding(?string $stadiaKey = 'test-stadia-key'): PlaceNameResolver
{
    config([
        'services.geocoding.providers' => ['stadia', 'photon', 'bigdatacloud'],
        'services.geocoding.stadia_key' => $stadiaKey,
    ]);
    app()->forgetInstance(PlaceNameResolver::class);

    return app(PlaceNameResolver::class);
}

function stadiaResponse(): array
{
    return ['features' => [['properties' => [
        'name' => 'Purificacion Street',
        'street' => 'Purificacion Street',
        'neighbourhood' => 'Bernabe Heights',
        'locality' => 'Caloocan',
        'region' => 'Metro Manila',
        'postalcode' => '1427',
        'country' => 'Philippines',
    ]]]];
}

function photonResponse(): array
{
    return ['features' => [['properties' => [
        'name' => 'Purificacion Street',
        'locality' => 'Bernabe Heights',
        'district' => 'Zone 16',
        'city' => 'Caloocan',
        'state' => 'Metro Manila',
        'postcode' => '1427',
        'country' => 'Philippines',
    ]]]];
}

it('names a point with Stadia first and caches it', function (): void {
    Http::fake([
        STADIA_URL => Http::response(stadiaResponse()),
        PHOTON_URL => Http::response(photonResponse()),
    ]);
    $resolver = enableGeocoding();

    $place = $resolver->resolveNow(14.762045, 121.07749);

    expect($place)->toBe([
        'status' => 'resolved',
        'primary' => 'Purificacion Street',
        'secondary' => 'Bernabe Heights, Caloocan, Metro Manila 1427, Philippines',
        'provider' => 'stadia',
    ]);
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'api_key=test-stadia-key')
        && str_contains($request->url(), 'point.lat=14.762045'));

    // Second lookup is served from the cache table.
    $resolver->resolveNow(14.762045, 121.07749);
    Http::assertSentCount(1);
    expect(GeocodedPlace::query()->count())->toBe(1);
});

it('falls back to Photon when Stadia fails and skips Stadia with no key', function (?string $key, int $expectedCalls): void {
    Http::fake([
        STADIA_URL => Http::response([], 500),
        PHOTON_URL => Http::response(photonResponse()),
    ]);

    $place = enableGeocoding($key)->resolveNow(14.762045, 121.07749);

    expect($place['provider'])->toBe('photon')
        ->and($place['primary'])->toBe('Purificacion Street')
        ->and($place['secondary'])->toBe('Bernabe Heights, Zone 16, Caloocan, Metro Manila 1427, Philippines');
    Http::assertSentCount($expectedCalls);
})->with([
    'Stadia errors' => ['test-stadia-key', 2],
    'no Stadia key' => [null, 1],
]);

it('falls back to BigDataCloud when Stadia and Photon both fail', function (): void {
    Http::fake([
        STADIA_URL => Http::response([], 503),
        PHOTON_URL => Http::response(['features' => []]),
        BDC_URL => Http::response([
            'locality' => 'Bagumbong',
            'city' => 'City of Caloocan',
            'principalSubdivision' => 'Metro Manila',
            'countryName' => 'Philippines',
        ]),
    ]);

    expect(enableGeocoding()->resolveNow(14.762045, 121.07749))->toBe([
        'status' => 'resolved',
        'primary' => 'Bagumbong',
        'secondary' => 'Caloocan, Metro Manila, Philippines',
        'provider' => 'bigdatacloud',
    ]);
});

it('never invents a name when every provider fails, and retries after the window', function (): void {
    Http::fake([
        '*' => Http::response([], 500),
    ]);
    $resolver = enableGeocoding();

    $first = $resolver->resolveNow(1.5, 2.5);

    expect($first)->toBe(['status' => 'unavailable', 'primary' => null, 'secondary' => null, 'provider' => null]);
    Http::assertSentCount(3);

    // Inside the retry window nothing is re-requested.
    $resolver->resolveNow(1.5, 2.5);
    Http::assertSentCount(3);

    $this->travel(16)->minutes();
    $resolver->resolveNow(1.5, 2.5);
    Http::assertSentCount(6);
});

it('describes cached places in one query and queues lookups for misses', function (): void {
    Http::fake([
        STADIA_URL => Http::response(stadiaResponse()),
    ]);
    $resolver = enableGeocoding();
    $resolver->resolveNow(14.762045, 121.07749);

    $described = $resolver->describeMany([
        [14.762045, 121.07749],
        [null, 121.0],
        ['not-a-number', 5],
    ]);

    expect($described)->toHaveCount(1)
        ->and($described[PlaceNameResolver::key(14.762045, 121.07749)]['status'])->toBe('resolved')
        ->and($resolver->describe(null, null))->toBeNull();
});

it('serves lookups to web sessions and mobile tokens, validating coordinates', function (): void {
    $this->seed(RolePermissionSeeder::class);
    Http::fake([
        STADIA_URL => Http::response(stadiaResponse()),
    ]);
    enableGeocoding();

    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $this->actingAs($user)
        ->getJson('/operations/places/reverse?latitude=14.762045&longitude=121.07749')
        ->assertOk()
        ->assertJsonPath('data.primary', 'Purificacion Street')
        ->assertJsonPath('data.status', 'resolved');

    $this->actingAs($user)
        ->getJson('/operations/places/reverse?latitude=95&longitude=121')
        ->assertStatus(422);

    $token = $user->createToken('Mobile Token')->plainTextToken;
    auth()->forgetGuards();

    $this->withToken($token)
        ->getJson('/api/v1/places/reverse?latitude=14.762045&longitude=121.07749')
        ->assertOk()
        ->assertJsonPath('data.provider', 'stadia');
});

it('rejects anonymous lookups', function (): void {
    $this->getJson('/api/v1/places/reverse?latitude=14.7&longitude=121.0')->assertUnauthorized();
    $this->getJson('/operations/places/reverse?latitude=14.7&longitude=121.0')->assertUnauthorized();
});

it('searches a site address with Stadia first, limited to the configured country', function (): void {
    Http::fake([
        STADIA_URL => Http::response(['features' => [[
            'geometry' => ['coordinates' => [121.0774900, 14.7620450]],
            'properties' => ['name' => 'Purificacion Street', 'locality' => 'Caloocan', 'country' => 'Philippines'],
        ]]]),
    ]);
    config(['services.geocoding.search_country' => 'PH']);

    $result = enableGeocoding()->search('Purificacion Street, Caloocan');

    expect($result)->toMatchArray(['latitude' => 14.762045, 'longitude' => 121.07749])
        ->and($result['place']['primary'])->toBe('Purificacion Street');
    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'boundary.country=PH'));
});

it('falls back to Photon for search and skips results outside the country', function (): void {
    Http::fake([
        STADIA_URL => Http::response(['features' => []]),
        PHOTON_URL => Http::response(['features' => [
            ['geometry' => ['coordinates' => [100.5, 13.7]], 'properties' => ['name' => 'Elsewhere', 'countrycode' => 'TH']],
            ['geometry' => ['coordinates' => [121.02, 14.55]], 'properties' => ['name' => 'Ayala Avenue', 'city' => 'Makati', 'countrycode' => 'PH']],
        ]]),
    ]);
    config(['services.geocoding.search_country' => 'PH']);

    $result = enableGeocoding()->search('Ayala Avenue');

    expect($result)->toMatchArray(['latitude' => 14.55, 'longitude' => 121.02])
        ->and($result['place']['provider'])->toBe('photon');
});

it('returns no pin when no provider finds the address, never a default location', function (): void {
    Http::fake(['*' => Http::response(['features' => []])]);
    $this->seed(RolePermissionSeeder::class);
    enableGeocoding();

    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $this->actingAs($user)
        ->getJson('/operations/places/search?q='.urlencode('Nowhere Street 99999'))
        ->assertNotFound()
        ->assertJsonMissingPath('data');
});
