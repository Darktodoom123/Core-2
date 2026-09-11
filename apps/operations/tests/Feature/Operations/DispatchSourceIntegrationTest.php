<?php

use App\Modules\Dispatch\Actions\CreateDispatchFromSource;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('creates a source-linked rental dispatch and exposes its source in the workspace', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);
    $client = Client::query()->create([
        'code' => 'CLI-SRC-1',
        'company_name' => 'Source Client',
        'status' => 'active',
    ]);
    $reservation = RentalReservation::query()->create([
        'reference' => 'RENT-SRC-1',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'status' => RentalReservationStatus::Reserved,
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'delivery_location' => 'Pasig staging area',
        'fulfillment_mode' => 'delivery',
    ]);

    $job = app(CreateDispatchFromSource::class)->handle(
        $dispatcher,
        $reservation,
        DispatchSourceType::RentalReservation,
        [
            'reference' => 'DSP-RENT-SRC-1',
            'client' => $client->company_name,
            'title' => 'Rental delivery',
            'site' => $reservation->delivery_location,
            'scheduled_start' => now()->addDay()->setTime(8, 0),
            'scheduled_end' => now()->addDay()->setTime(10, 0),
            'priority' => DispatchPriority::Routine,
        ],
    );

    expect($job->source_type)->toBe(DispatchSourceType::RentalReservation->value)
        ->and($job->source_id)->toBe($reservation->id)
        ->and($job->source_reference)->toBe($reservation->reference)
        ->and($job->source)->toBeInstanceOf(RentalReservation::class);

    $this->actingAs($dispatcher)->get('/?view=dispatch')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-dispatch', fn (Assert $section) => $section
                ->where('jobs.0.source.type', 'rental_reservation')
                ->where('jobs.0.source.label', 'Rental')
                ->where('jobs.0.source.reference', 'RENT-SRC-1')
                ->where('jobs.0.source.fulfillment_mode', 'delivery')
                ->where('jobs.0.source.location', 'Pasig staging area')));
});

it('rejects a source type that does not match the source model', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);
    $client = Client::query()->create([
        'code' => 'CLI-SRC-2',
        'company_name' => 'Source Client',
        'status' => 'active',
    ]);
    $reservation = RentalReservation::query()->create([
        'reference' => 'RENT-SRC-2',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'status' => RentalReservationStatus::Reserved,
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'fulfillment_mode' => 'pickup',
    ]);

    expect(fn () => app(CreateDispatchFromSource::class)->handle(
        $dispatcher,
        $reservation,
        DispatchSourceType::SalesOrder,
        [
            'reference' => 'DSP-SRC-MISMATCH',
            'client' => $client->company_name,
            'title' => 'Invalid source',
            'site' => 'Warehouse',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHour(),
        ],
    ))->toThrow(ValidationException::class);

    expect(DispatchJob::query()->where('reference', 'DSP-SRC-MISMATCH')->exists())->toBeFalse();
});
