<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Exports\SystemAuditExportDataset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('exports who did what and the request it belongs to, but never free-text reasons', function (): void {
    $this->seed(RolePermissionSeeder::class);
    $admin = User::factory()->create(['name' => 'Ada Admin']);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    AuditEvent::query()->create([
        'actor_id' => $admin->id,
        'subject_type' => 'user',
        'subject_id' => $admin->id,
        'action' => 'gpt.circuit_breaker_paused',
        'reason' => 'Spend spike',
        'request_id' => '5b0e9b4e-1d1c-4a51-9d0b-6a3e0f7f2c11',
        'ip_address' => '10.0.0.5',
        'occurred_at' => now(),
    ]);

    $dataset = app(SystemAuditExportDataset::class);
    $rows = iterator_to_array($dataset->rows($admin, []), false);
    $row = array_combine($dataset->headers(), $rows[0]);

    expect($row)->toMatchArray([
        'Actor' => 'Ada Admin',
        'Action' => 'gpt.circuit_breaker_paused',
        'Request ID' => '5b0e9b4e-1d1c-4a51-9d0b-6a3e0f7f2c11',
    ])->and(array_values($row))->not->toContain('Spend spike');
});
