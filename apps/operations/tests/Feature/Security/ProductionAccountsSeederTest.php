<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

/**
 * Seeds as production with the given account settings, restoring the
 * environment and configuration afterwards.
 *
 * @param  array<string, array<string, string|null>>  $accounts
 */
function seedProductionWith(array $accounts): void
{
    $originalEnvironment = app()->environment();
    $originalPassword = config('auth.bootstrap_admin_password');
    $originalAccounts = config('auth.production_accounts');

    app()->detectEnvironment(fn (): string => 'production');
    config([
        'auth.bootstrap_admin_password' => 'production-bootstrap-secret',
        'auth.production_accounts' => $accounts,
    ]);

    try {
        app(DatabaseSeeder::class)->run();
    } finally {
        app()->detectEnvironment(fn () => $originalEnvironment);
        config(['auth.bootstrap_admin_password' => $originalPassword, 'auth.production_accounts' => $originalAccounts]);
    }
}

function productionAccounts(array $overrides = []): array
{
    return array_replace_recursive([
        'admin' => ['name' => 'Ada Admin', 'email' => 'ada@alibaton.test'],
        'manager' => ['name' => 'Mia Manager', 'email' => 'mia@alibaton.test', 'password' => 'manager-secret-123'],
        'operator' => ['name' => 'Oscar Operator', 'email' => 'oscar@alibaton.test', 'password' => 'operator-secret-123'],
    ], $overrides);
}

it('creates the admin, manager, and operator logins with configured emails', function (): void {
    seedProductionWith(productionAccounts());

    $admin = User::query()->where('username', 'admin')->sole();
    $manager = User::query()->where('username', 'manager')->sole();
    $operator = User::query()->where('username', 'operator')->sole();

    expect($admin->email)->toBe('ada@alibaton.test')
        ->and($admin->name)->toBe('Ada Admin')
        ->and($admin->hasRole(RoleName::SystemAdministrator->value))->toBeTrue()
        ->and(Hash::check('production-bootstrap-secret', $admin->getRawOriginal('password')))->toBeTrue()
        ->and($manager->email)->toBe('mia@alibaton.test')
        ->and($manager->hasRole(RoleName::OperationsManager->value))->toBeTrue()
        ->and($manager->is_active)->toBeTrue()
        ->and(Hash::check('manager-secret-123', $manager->getRawOriginal('password')))->toBeTrue()
        ->and($operator->email)->toBe('oscar@alibaton.test')
        ->and($operator->hasRole(RoleName::CraneOperator->value))->toBeTrue()
        ->and(Hash::check('operator-secret-123', $operator->getRawOriginal('password')))->toBeTrue()
        ->and(User::query()->count())->toBe(3);
});

it('re-seeds without duplicating accounts or overwriting changed passwords', function (): void {
    seedProductionWith(productionAccounts());
    User::query()->where('username', 'manager')->update(['password' => Hash::make('changed-by-manager')]);

    seedProductionWith(productionAccounts());

    expect(User::query()->count())->toBe(3)
        ->and(User::query()->where('email', 'admin@example.com')->exists())->toBeFalse()
        ->and(Hash::check('changed-by-manager', User::query()->where('username', 'manager')->sole()->getRawOriginal('password')))->toBeTrue();
});

it('keeps the bootstrap admin only when no production accounts are configured', function (): void {
    seedProductionWith(['admin' => [], 'manager' => [], 'operator' => []]);

    expect(User::query()->pluck('email')->all())->toBe(['admin@example.com']);
});

it('refuses a manager or operator without a strong password before writing them', function (): void {
    expect(fn () => seedProductionWith(productionAccounts(['operator' => ['password' => 'short']])))
        ->toThrow(RuntimeException::class, 'OPERATOR_PASSWORD must contain at least 12 characters');

    expect(User::query()->where('username', 'operator')->exists())->toBeFalse();
});

it('refuses an invalid or already-used email', function (): void {
    expect(fn () => seedProductionWith(productionAccounts(['manager' => ['email' => 'not-an-email']])))
        ->toThrow(InvalidArgumentException::class, 'MANAGER_EMAIL must be a valid email address');

    expect(fn () => seedProductionWith(productionAccounts(['operator' => ['email' => 'mia@alibaton.test']])))
        ->toThrow(InvalidArgumentException::class, 'OPERATOR_EMAIL is already used by another account');
});
