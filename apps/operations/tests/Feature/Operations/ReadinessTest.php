<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('reports readiness only after the Operations migrations are applied', function (): void {
    $this->getJson('/ready')
        ->assertOk()
        ->assertJsonPath('status', 'ready')
        ->assertJsonPath('database', 'ok')
        ->assertJsonPath('migrations', 'ok');
});

it('reports Operations as unready while migrations are pending', function (): void {
    DB::table('migrations')->delete();

    $this->getJson('/ready')
        ->assertStatus(503)
        ->assertJsonPath('status', 'unready')
        ->assertJsonPath('migrations', 'pending');
});
