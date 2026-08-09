<?php

use App\Platform\Identity\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('has a required unique username column after the backfill migration', function (): void {
    expect(Schema::hasColumn('users', 'username'))->toBeTrue();

    $first = User::factory()->create(['username' => 'migration-user']);

    expect($first->username)->toBe('migration-user')
        ->and(fn (): User => User::factory()->create(['username' => 'migration-user']))
        ->toThrow(QueryException::class);

    expect(fn () => DB::table('users')->insert([
        'name' => 'No Username',
        'email' => 'no-username@example.test',
        'password' => 'not-a-real-password',
        'username' => null,
    ]))->toThrow(QueryException::class);
});
