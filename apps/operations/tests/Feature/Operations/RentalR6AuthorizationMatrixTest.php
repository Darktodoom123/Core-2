<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalCheckout;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

/** @return list<array{route: string, permission: PermissionName, adjacent: PermissionName}> */
function r6AuthorizationRoutes(): array
{
    return [
        ['route' => 'rental.index', 'permission' => PermissionName::RentalView, 'adjacent' => PermissionName::DispatchViewAll],
        ['route' => 'rental.store', 'permission' => PermissionName::RentalCreate, 'adjacent' => PermissionName::DispatchCreate],
        ['route' => 'rental.approve', 'permission' => PermissionName::RentalApprove, 'adjacent' => PermissionName::RentalCreate],
        ['route' => 'rental.checkout', 'permission' => PermissionName::RentalCheckout, 'adjacent' => PermissionName::RentalApprove],
        ['route' => 'rental.return', 'permission' => PermissionName::RentalReturn, 'adjacent' => PermissionName::RentalCheckout],
    ];
}

function r6AuthorizationClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-R6-'.fake()->unique()->numerify('#####'),
        'company_name' => 'R6 authorization customer',
        'status' => 'active',
    ]);
}

function r6AuthorizationAsset(AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => 'EQ-R6-'.fake()->unique()->numerify('#####'),
        'name' => 'R6 authorization asset',
        'kind' => 'equipment',
        'status' => $status,
    ]);
}

function r6AuthorizationUser(): User
{
    return User::factory()->create();
}

/** @return array{client: Client, asset: OperationalAsset, reservation: RentalReservation|null} */
function r6AuthorizationContext(string $route): array
{
    $client = r6AuthorizationClient();
    $asset = r6AuthorizationAsset($route === 'rental.return' ? AssetStatus::Assigned : AssetStatus::Available);
    $reservation = null;

    if (in_array($route, ['rental.approve', 'rental.checkout', 'rental.return'], true)) {
        $status = match ($route) {
            'rental.approve' => RentalReservationStatus::Requested,
            'rental.checkout' => RentalReservationStatus::Reserved,
            default => RentalReservationStatus::CheckedOut,
        };
        $reservation = RentalReservation::query()->create([
            'reference' => 'REN-R6-'.fake()->unique()->numerify('#####'),
            'client_id' => $client->id,
            'created_by' => User::factory()->create()->id,
            'status' => $status,
            'start_date' => CarbonImmutable::tomorrow()->toDateString(),
            'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
            'fulfillment_mode' => $route === 'rental.checkout' ? 'pickup' : 'delivery',
            'total_cents' => 100,
        ]);
        RentalReservationItem::query()->create([
            'rental_reservation_id' => $reservation->id,
            'operational_asset_id' => $asset->id,
            'quantity' => 1,
            'rate_cents' => 100,
            'line_total_cents' => 200,
        ]);

        if ($route === 'rental.return') {
            RentalCheckout::query()->create([
                'rental_reservation_id' => $reservation->id,
                'checked_out_by' => $reservation->created_by,
                'checked_out_at' => now(),
                'condition_before' => ['engine' => 'good'],
            ]);
        }
    }

    return compact('client', 'asset', 'reservation');
}

function r6InvokeAuthorizationRoute(TestCase $test, string $route, User $actor, ?array $context = null): TestResponse
{
    $context ??= r6AuthorizationContext($route);
    $client = $context['client'];
    $asset = $context['asset'];

    return match ($route) {
        'rental.index' => $test->actingAs($actor)->getJson('/operations/rental-reservations'),
        'rental.store' => $test->actingAs($actor)->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R6-NEW-'.fake()->unique()->numerify('#####'),
            'client_id' => $client->id,
            'start_date' => CarbonImmutable::tomorrow()->toDateString(),
            'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
        ]),
        'rental.approve' => $test->actingAs($actor)->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/approve'),
        'rental.checkout' => $test->actingAs($actor)->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/checkout', ['condition' => ['engine' => 'good']]),
        'rental.return' => $test->actingAs($actor)->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/return', ['condition' => ['engine' => 'good']]),
    };
}

it('allows only the exact dedicated permission on every Rental route', function (string $route, PermissionName $permission, PermissionName $adjacent): void {
    $actor = r6AuthorizationUser();
    $actor->givePermissionTo($permission->value);

    $response = r6InvokeAuthorizationRoute($this, $route, $actor);

    expect($response->status())->toBeIn([200, 201]);
})->with(r6AuthorizationRoutes());

it('does not substitute an adjacent permission on any route', function (string $route, PermissionName $permission, PermissionName $adjacent): void {
    $actor = r6AuthorizationUser();
    $actor->givePermissionTo($adjacent->value);

    $response = r6InvokeAuthorizationRoute($this, $route, $actor);

    $response->assertForbidden();
})->with(r6AuthorizationRoutes());

it('rejects guests at the session boundary for every Rental route', function (string $route): void {
    $context = r6AuthorizationContext($route);
    $response = match ($route) {
        'rental.index' => $this->getJson('/operations/rental-reservations'),
        'rental.store' => $this->postJson('/operations/rental-reservations', ['reference' => 'guest', 'client_id' => $context['client']->id, 'start_date' => CarbonImmutable::tomorrow()->toDateString(), 'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(), 'fulfillment_mode' => 'delivery', 'items' => [['operational_asset_id' => $context['asset']->id, 'quantity' => 1, 'rate_cents' => 100]]]),
        'rental.approve' => $this->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/approve'),
        'rental.checkout' => $this->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/checkout', ['condition' => ['engine' => 'good']]),
        'rental.return' => $this->postJson('/operations/rental-reservations/'.$context['reservation']->id.'/return', ['condition' => ['engine' => 'good']]),
    };

    expect($response->status())->toBeIn([401, 302]);
})->with(array_column(r6AuthorizationRoutes(), 'route'));

it('rejects inactive, suspended, and unverified users for every Rental route', function (string $accountState, string $route): void {
    $context = r6AuthorizationContext($route);
    $actor = match ($accountState) {
        'inactive' => User::factory()->create(['is_active' => false]),
        'suspended' => User::factory()->suspended()->create(),
        default => User::factory()->unverified()->create(),
    };
    $response = r6InvokeAuthorizationRoute($this, $route, $actor);

    expect($response->status())->toBe(403);
})->with(['inactive', 'suspended', 'unverified'])->with(array_column(r6AuthorizationRoutes(), 'route'));

it('rejects every unauthorized mutation without domain, asset, evidence, or success-audit changes', function (string $route, PermissionName $permission, PermissionName $adjacent): void {
    $actor = r6AuthorizationUser();
    $actor->givePermissionTo($adjacent->value);
    $context = r6AuthorizationContext($route);
    $before = [
        'rental_reservations' => RentalReservation::query()->count(),
        'rental_reservation_items' => RentalReservationItem::query()->count(),
        'rental_checkouts' => RentalCheckout::query()->count(),
        'rental_returns' => $this->getConnection()->table('rental_returns')->count(),
        'audit_events' => AuditEvent::query()->count(),
    ];
    $response = r6InvokeAuthorizationRoute($this, $route, $actor, $context);

    $response->assertForbidden();
    foreach ($before as $table => $count) {
        $actual = match ($table) {
            'rental_reservations' => RentalReservation::query()->count(),
            'rental_reservation_items' => RentalReservationItem::query()->count(),
            'rental_checkouts' => RentalCheckout::query()->count(),
            'audit_events' => AuditEvent::query()->count(),
            default => $this->getConnection()->table($table)->count(),
        };
        expect($actual, $table)->toBe($count);
    }
})->with(array_values(array_filter(r6AuthorizationRoutes(), static fn (array $case): bool => str_ends_with($case['route'], '.store') || in_array($case['route'], ['rental.approve', 'rental.checkout', 'rental.return'], true))));
