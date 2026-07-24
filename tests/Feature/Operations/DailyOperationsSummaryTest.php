<?php

use App\Enums\RoleName;
use App\Models\AuditEvent;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createSummaryUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('provides permission-scoped daily operations summary and logs access audit', function (): void {
    $manager = createSummaryUser(RoleName::OperationsManager);
    $driver = createSummaryUser(RoleName::Driver);

    // Manager summary
    $res = $this->actingAs($manager)
        ->getJson('/operations/reports/daily-summary')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'summary_date',
                'dispatches' => ['created_today', 'active_count', 'completed_today', 'status_breakdown'],
                'reports' => ['submitted_today'],
                'fuel',
                'maintenance',
            ],
        ]);

    expect(AuditEvent::query()->where('action', 'reports.daily_summary_viewed')->exists())->toBeTrue();

    // Driver summary (scoped)
    $this->actingAs($driver)
        ->getJson('/operations/reports/daily-summary')
        ->assertStatus(200);
});
