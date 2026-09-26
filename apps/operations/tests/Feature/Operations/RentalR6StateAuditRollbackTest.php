<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
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
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

function r6StateUser(PermissionName ...$permissions): User
{
    $user = User::factory()->create();
    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission->value);
    }

    return $user;
}

function r6StateClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-R6S-'.fake()->unique()->numerify('#####'),
        'company_name' => 'R6 state customer',
        'status' => 'active',
    ]);
}

function r6StateAsset(AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => 'EQ-R6S-'.fake()->unique()->numerify('#####'),
        'name' => 'R6 state asset',
        'kind' => 'equipment',
        'status' => $status,
    ]);
}

function r6StateReservation(User $creator, OperationalAsset $asset, RentalReservationStatus $status): RentalReservation
{
    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-R6S-'.fake()->unique()->numerify('#####'),
        'client_id' => r6StateClient()->id,
        'created_by' => $creator->id,
        'status' => $status,
        'start_date' => CarbonImmutable::tomorrow()->toDateString(),
        'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
        'fulfillment_mode' => 'delivery',
        'total_cents' => 200,
    ]);
    RentalReservationItem::query()->create([
        'rental_reservation_id' => $reservation->id,
        'operational_asset_id' => $asset->id,
        'quantity' => 1,
        'rate_cents' => 100,
        'line_total_cents' => 200,
    ]);

    return $reservation->fresh();
}

/** @return array{rental: array{before: list<string>, after: list<string>}} */
function r6AuditAllowLists(): array
{
    return [
        'rental' => [
            'before' => ['id', 'reference', 'client_id', 'created_by', 'approved_by', 'dispatch_job_id', 'status', 'start_date', 'end_date', 'fulfillment_mode', 'total_cents', 'created_at', 'updated_at', 'deleted_at'],
            'after' => ['id', 'reference', 'client_id', 'created_by', 'approved_by', 'dispatch_job_id', 'status', 'start_date', 'end_date', 'fulfillment_mode', 'total_cents', 'created_at', 'updated_at', 'deleted_at'],
        ],
    ];
}

it('rejects every invalid Rental source state without mutation or success audit', function (string $operation, string $status): void {
    $actor = match ($operation) {
        'rental.approve' => r6StateUser(PermissionName::RentalApprove),
        'rental.checkout' => r6StateUser(PermissionName::RentalCheckout),
        default => r6StateUser(PermissionName::RentalReturn),
    };
    $asset = r6StateAsset($operation === 'rental.return' ? AssetStatus::Assigned : AssetStatus::Available);
    $reservation = r6StateReservation($actor, $asset, RentalReservationStatus::from($status));

    $url = match ($operation) {
        'rental.approve' => "/operations/rental-reservations/{$reservation->id}/approve",
        'rental.checkout' => "/operations/rental-reservations/{$reservation->id}/checkout",
        default => "/operations/rental-reservations/{$reservation->id}/return",
    };
    $payload = str_contains($operation, 'checkout') || str_contains($operation, 'return')
        ? ['condition' => ['engine' => 'good']]
        : [];
    $before = [
        'reservations' => RentalReservation::query()->count(),
        'reservation_status' => $reservation->fresh()->status->value,
        'checkouts' => RentalCheckout::query()->count(),
        'returns' => $this->getConnection()->table('rental_returns')->count(),
        'audits' => AuditEvent::query()->count(),
        'asset_status' => $asset->fresh()->status->value,
    ];

    $this->actingAs($actor)->postJson($url, $payload)->assertUnprocessable();

    expect([
        'reservations' => RentalReservation::query()->count(),
        'reservation_status' => $reservation->fresh()->status->value,
        'checkouts' => RentalCheckout::query()->count(),
        'returns' => $this->getConnection()->table('rental_returns')->count(),
        'audits' => AuditEvent::query()->count(),
        'asset_status' => $asset->fresh()->status->value,
    ])->toBe($before);
})->with([
    ['rental.approve', RentalReservationStatus::Reserved->value],
    ['rental.approve', RentalReservationStatus::CheckedOut->value],
    ['rental.approve', RentalReservationStatus::Returned->value],
    ['rental.approve', RentalReservationStatus::Closed->value],
    ['rental.checkout', RentalReservationStatus::Requested->value],
    ['rental.checkout', RentalReservationStatus::CheckedOut->value],
    ['rental.checkout', RentalReservationStatus::Returned->value],
    ['rental.checkout', RentalReservationStatus::Closed->value],
    ['rental.return', RentalReservationStatus::Requested->value],
    ['rental.return', RentalReservationStatus::Reserved->value],
    ['rental.return', RentalReservationStatus::Returned->value],
    ['rental.return', RentalReservationStatus::Closed->value],
]);

it('records the exact safe audit matrix with actor, subject, UUID, IP, and bounded time', function (): void {
    $dispatcher = r6StateUser(PermissionName::RentalCreate, PermissionName::RentalCheckout, PermissionName::RentalReturn);
    $manager = r6StateUser(PermissionName::RentalApprove);
    $rentalAsset = r6StateAsset();
    $rentalClient = r6StateClient();
    $start = CarbonImmutable::tomorrow();
    $rentalPayload = [
        'reference' => 'REN-R6-AUDIT',
        'client_id' => $rentalClient->id,
        'start_date' => $start->toDateString(),
        'end_date' => $start->addDay()->toDateString(),
        'fulfillment_mode' => 'pickup',
        'delivery_location' => 'private location/contact data',
        'notes' => 'private rental notes/contact data',
        'items' => [['operational_asset_id' => $rentalAsset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ];
    $request = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.55']);
    $request->actingAs($dispatcher)->postJson('/operations/rental-reservations', $rentalPayload)->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-R6-AUDIT')->sole();
    $request->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();
    $request->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good'], 'notes' => 'private checkout note'])->assertOk();
    $request->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/return", ['condition' => ['engine' => 'good'], 'damage_notes' => 'private damage/contact data'])->assertOk();

    $allowLists = r6AuditAllowLists();
    $actions = [
        'rental_reservation.created' => [$dispatcher->id, $reservation->id, 'rental'],
        'rental_reservation.approved' => [$manager->id, $reservation->id, 'rental'],
        'rental_reservation.checked_out' => [$dispatcher->id, $reservation->id, 'rental'],
        'rental_reservation.returned' => [$dispatcher->id, $reservation->id, 'rental'],
    ];
    $startedAt = now()->subMinutes(2);
    foreach ($actions as $action => [$actorId, $subjectId, $subjectKind]) {
        $audit = AuditEvent::query()->where('action', $action)->sole();
        $keys = $allowLists[$subjectKind];
        $expectedBefore = str_ends_with($action, '.created') ? null : $keys['before'];
        $actualBefore = $audit->before === null ? null : array_keys($audit->before);
        $actualAfter = $audit->after === null ? null : array_keys($audit->after);
        if (is_array($expectedBefore)) {
            sort($expectedBefore);
            sort($actualBefore);
        }
        $expectedAfter = $keys['after'];
        sort($expectedAfter);
        sort($actualAfter);
        expect($audit->actor_id)->toBe($actorId)
            ->and((string) $audit->subject_id)->toBe((string) $subjectId)
            ->and(Str::isUuid((string) $audit->request_id))->toBeTrue()
            ->and($audit->ip_address)->toBe('203.0.113.55')
            ->and($audit->occurred_at->between($startedAt, now()->addMinute()))->toBeTrue()
            ->and($actualBefore)->toBe($expectedBefore)
            ->and($actualAfter)->toBe($expectedAfter);
        $serialized = json_encode([$audit->before, $audit->after], JSON_THROW_ON_ERROR);
        expect($serialized)->not->toContain('private')
            ->and($serialized)->not->toContain('contact')
            ->and($serialized)->not->toContain('location')
            ->and($serialized)->not->toContain('damage');
    }
});

it('rolls back the business transaction when an audit write fails', function (): void {
    $actor = r6StateUser(PermissionName::RentalCreate);
    $client = r6StateClient();
    $asset = r6StateAsset();
    $failure = new RuntimeException('injected audit failure');
    $this->withoutExceptionHandling();
    $listener = function (QueryExecuted $query) use ($failure): void {
        if (str_contains(strtolower($query->sql), 'insert into "audit_events"')) {
            throw $failure;
        }
    };
    $this->app['db']->listen($listener);

    expect(fn () => $this->actingAs($actor)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-R6-FAIL-AUDIT',
        'client_id' => $client->id,
        'start_date' => CarbonImmutable::tomorrow()->toDateString(),
        'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
        'fulfillment_mode' => 'delivery',
        'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ]))->toThrow($failure);

    expect(RentalReservation::query()->count())->toBe(0)
        ->and(RentalReservationItem::query()->count())->toBe(0)
        ->and(AuditEvent::query()->count())->toBe(0)
        ->and($asset->fresh()->status)->toBe(AssetStatus::Available);
});

it('does not partially checkout or return multi-item rental operations', function (string $operation): void {
    $actor = r6StateUser($operation === 'checkout' ? PermissionName::RentalCheckout : PermissionName::RentalReturn);
    $firstAsset = r6StateAsset($operation === 'return' ? AssetStatus::Assigned : AssetStatus::Available);
    $secondAsset = r6StateAsset($operation === 'return' ? AssetStatus::Assigned : AssetStatus::Available);

    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-R6-MULTI-'.$operation,
        'client_id' => r6StateClient()->id,
        'created_by' => $actor->id,
        'status' => $operation === 'checkout' ? RentalReservationStatus::Reserved : RentalReservationStatus::CheckedOut,
        'start_date' => CarbonImmutable::tomorrow()->toDateString(),
        'end_date' => CarbonImmutable::tomorrow()->addDay()->toDateString(),
        'fulfillment_mode' => 'delivery',
        'total_cents' => 200,
    ]);
    $reservation->items()->createMany([
        ['operational_asset_id' => $firstAsset->id, 'quantity' => 1, 'rate_cents' => 100, 'line_total_cents' => 200],
        ['operational_asset_id' => $secondAsset->id, 'quantity' => 1, 'rate_cents' => 100, 'line_total_cents' => 200],
    ]);
    if ($operation === 'return') {
        RentalCheckout::query()->create(['rental_reservation_id' => $reservation->id, 'checked_out_by' => $actor->id, 'checked_out_at' => now(), 'condition_before' => ['engine' => 'good']]);
        $secondAsset->delete();
    } else {
        $job = DispatchJob::query()->create(['reference' => 'DSP-R6-MULTI', 'client' => 'R6', 'title' => 'R6 blocker', 'site' => 'R6', 'scheduled_start' => CarbonImmutable::tomorrow()->addHours(2), 'scheduled_end' => CarbonImmutable::tomorrow()->addHours(4), 'priority' => DispatchPriority::Routine, 'status' => DispatchStatus::Scheduled, 'created_by' => $actor->id, 'version' => 1]);
        $job->assetAssignments()->create(['operational_asset_id' => $secondAsset->id, 'assignment_type' => 'equipment', 'assigned_by' => $actor->id, 'active_from' => $job->scheduled_start]);
    }
    $url = $operation === 'checkout' ? "/operations/rental-reservations/{$reservation->id}/checkout" : "/operations/rental-reservations/{$reservation->id}/return";
    $this->actingAs($actor)->postJson($url, ['condition' => ['engine' => 'good']])->assertUnprocessable();
    expect($reservation->fresh()->status)->toBe($operation === 'checkout' ? RentalReservationStatus::Reserved : RentalReservationStatus::CheckedOut)
        ->and(RentalCheckout::query()->count())->toBe($operation === 'checkout' ? 0 : 1)
        ->and($this->getConnection()->table('rental_returns')->count())->toBe(0)
        ->and($firstAsset->fresh()->status)->toBe($operation === 'return' ? AssetStatus::Assigned : AssetStatus::Available)
        ->and(AuditEvent::query()->whereIn('action', ['rental_reservation.checked_out', 'rental_reservation.returned'])->count())->toBe(0);
})->with(['checkout', 'return']);
