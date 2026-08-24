<?php

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    expect(DB::connection()->getDriverName())->toBe('pgsql');
    $this->seed(RolePermissionSeeder::class);
});

it('installs the PostgreSQL read-model indexes used by bounded candidate queries', function (): void {
    $indexes = [
        'dispatch_personnel_user_active_job_read_index',
        'dispatch_asset_asset_active_job_read_index',
        'maintenance_dispatch_blocking_asset_read_index',
        'inspections_passing_asset_read_index',
        'approval_subject_kind_latest_read_index',
    ];

    foreach ($indexes as $index) {
        $definition = DB::selectOne(
            'select indexdef from pg_indexes where schemaname = current_schema() and indexname = ?',
            [$index],
        );

        expect($definition?->indexdef)->toBeString()->not->toBe('');
    }

    $maintenance = DB::selectOne(
        'select indexdef from pg_indexes where schemaname = current_schema() and indexname = ?',
        ['maintenance_dispatch_blocking_asset_read_index'],
    );
    $inspection = DB::selectOne(
        'select indexdef from pg_indexes where schemaname = current_schema() and indexname = ?',
        ['inspections_passing_asset_read_index'],
    );

    expect(strtolower((string) $maintenance?->indexdef))
        ->toContain('where')
        ->toContain('dispatch_blocking')
        ->toContain('released_at')
        ->and(strtolower((string) $inspection?->indexdef))
        ->toContain('where')
        ->toContain('result')
        ->toContain('completed_at');
});
