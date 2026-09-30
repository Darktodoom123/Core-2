<?php

use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\Development\Core1IncomingWorkSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('seeds undispatched Core 1 job orders and rentals into incoming work', function () {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);
    OperationalAsset::query()->create([
        'code' => 'CRANE-50T',
        'name' => '50T Tadano Hydraulic Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Working,
    ]);

    $this->seed(Core1IncomingWorkSeeder::class);
    $this->seed(Core1IncomingWorkSeeder::class);

    expect(ServiceRequest::query()->where('reference', 'JO-2026-0201')->value('requirements'))
        ->toBe(['CRANE-50T · 50T Tadano Hydraulic Crane', 'Operator']);

    expect(ServiceRequest::query()->where('reference', 'like', 'JO-2026-%')->count())->toBe(6)
        ->and(RentalReservation::query()->where('reference', 'like', 'RN-2026-%')->count())->toBe(2);

    $this->actingAs($manager)
        ->getJson('/operations/dispatch-desk/incoming')
        ->assertOk()
        ->assertJsonPath('total', 8)
        ->assertJsonFragment(['reference' => 'JO-2026-0205'])
        ->assertJsonFragment(['reference' => 'RN-2026-0031'])
        ->assertJsonFragment(['name' => 'CRANE-50T · 50T Tadano Hydraulic Crane', 'quantity' => 1, 'operator' => 'Operator']);
});
