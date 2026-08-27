<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\BrowserAcceptanceSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\LocalDevelopmentSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it('rejects a production bootstrap password before writing any records', function (): void {
    $originalEnvironment = app()->environment();
    $originalPassword = config('auth.bootstrap_admin_password');

    app()->detectEnvironment(fn (): string => 'production');
    config(['auth.bootstrap_admin_password' => 'too-short']);

    try {
        expect(fn (): mixed => app(DatabaseSeeder::class)->run())
            ->toThrow(RuntimeException::class, 'ADMIN_PASSWORD must contain at least 12 characters');
        expect(User::query()->count())->toBe(0);
    } finally {
        app()->detectEnvironment(fn () => $originalEnvironment);
        config(['auth.bootstrap_admin_password' => $originalPassword]);
    }
});

it('bootstraps production administration without creating or re-enabling fixture accounts', function (): void {
    $fixture = User::query()->create([
        'name' => 'Existing Dispatcher Fixture',
        'username' => 'dispatcher',
        'email' => 'dispatcher@example.com',
        'email_verified_at' => now(),
        'password' => Hash::make('existing-secret'),
        'is_active' => false,
        'suspended_at' => now(),
    ]);
    $existingPasswordHash = $fixture->getRawOriginal('password');
    $originalEnvironment = app()->environment();
    $originalPassword = config('auth.bootstrap_admin_password');

    app()->detectEnvironment(fn (): string => 'production');
    config(['auth.bootstrap_admin_password' => 'production-only-bootstrap-secret']);

    try {
        app(DatabaseSeeder::class)->run();

        $administrator = User::query()->where('email', 'admin@example.com')->firstOrFail();

        expect(User::query()->where('email', 'admin@example.com')->count())->toBe(1)
            ->and($administrator->hasRole(RoleName::SystemAdministrator->value))->toBeTrue()
            ->and(Hash::check('production-only-bootstrap-secret', $administrator->getRawOriginal('password')))->toBeTrue()
            ->and(User::query()->whereIn('email', [
                'dispatcher@example.com',
                'manager@example.com',
                'driver@example.com',
                'operator@example.com',
                'browser.dispatcher@example.com',
                'browser.manager@example.com',
                'browser.driver@example.com',
            ])->count())->toBe(1);

        $fixture->refresh();
        expect($fixture->is_active)->toBeFalse()
            ->and($fixture->suspended_at)->not->toBeNull()
            ->and($fixture->getRawOriginal('password'))->toBe($existingPasswordHash);
    } finally {
        app()->detectEnvironment(fn () => $originalEnvironment);
        config(['auth.bootstrap_admin_password' => $originalPassword]);
    }
});

it('rejects local and browser fixture seeders outside local or testing environments', function (): void {
    $originalEnvironment = app()->environment();
    app()->detectEnvironment(fn (): string => 'production');
    app(RolePermissionSeeder::class)->run();

    try {
        foreach ([LocalDevelopmentSeeder::class, BrowserAcceptanceSeeder::class] as $seeder) {
            expect(fn (): mixed => app($seeder)->run())
                ->toThrow(LogicException::class, 'only be seeded in local or testing environments');
        }

        expect(User::query()->count())->toBe(0);
    } finally {
        app()->detectEnvironment(fn () => $originalEnvironment);
    }
});

it('keeps local developer seeding idempotent and usable', function (): void {
    $originalEnvironment = app()->environment();
    app()->detectEnvironment(fn (): string => 'local');

    try {
        app(DatabaseSeeder::class)->run();
        app(DatabaseSeeder::class)->run();

        expect(User::query()->where('email', 'admin@example.com')->count())->toBe(1)
            ->and(User::query()->whereIn('email', [
                'dispatcher@example.com',
                'manager@example.com',
                'driver@example.com',
                'operator@example.com',
            ])->count())->toBe(4)
            ->and(DB::table('location_updates')->count())->toBe(2);

        $dispatcher = User::query()->where('email', 'dispatcher@example.com')->firstOrFail();
        expect(Hash::check('password', $dispatcher->getRawOriginal('password')))->toBeTrue()
            ->and($dispatcher->is_active)->toBeTrue();
    } finally {
        app()->detectEnvironment(fn () => $originalEnvironment);
    }
});
