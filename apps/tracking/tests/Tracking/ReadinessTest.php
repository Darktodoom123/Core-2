<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('reports migrated readiness separately from the liveness endpoint', function (): void {
    $this->getJson('/up')->assertOk();

    $this->getJson('/ready')
        ->assertOk()
        ->assertJsonPath('status', 'ready')
        ->assertJsonPath('database', 'ok')
        ->assertJsonPath('migrations', 'ok');
});

it('reports unready while migrations are pending', function (): void {
    DB::table('migrations')->delete();

    $this->getJson('/ready')
        ->assertStatus(503)
        ->assertJsonPath('status', 'unready')
        ->assertJsonPath('migrations', 'pending');
});
