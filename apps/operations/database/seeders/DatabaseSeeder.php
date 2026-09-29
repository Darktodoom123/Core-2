<?php

namespace Database\Seeders;

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use Database\Seeders\Development\LocalAccountOverrides;
use Database\Seeders\Development\LocalDevelopmentSeeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $bootstrapPassword = config('auth.bootstrap_admin_password');

        if (app()->environment('production') && (! is_string($bootstrapPassword) || strlen($bootstrapPassword) < 12)) {
            throw new RuntimeException('ADMIN_PASSWORD must contain at least 12 characters when seeding production.');
        }

        $localAccountOverrides = app()->environment('local') ? LocalAccountOverrides::fromConfig() : null;
        $localAccountOverrides?->restoreFixtureEmails();
        $productionAccounts = app()->environment('local') ? null : ProductionAccounts::fromConfig();

        $this->call(RolePermissionSeeder::class);

        // Look the admin up by username: production may have moved it to a real email.
        $administrator = User::query()->where('username', Username::fromEmail('admin@example.com'))->first()
            ?? User::query()->firstOrCreate(
                ['email' => 'admin@example.com'],
                [
                    'name' => 'System Administrator',
                    'username' => Username::fromEmail('admin@example.com'),
                    'email_verified_at' => now(),
                    'password' => Hash::make(is_string($bootstrapPassword) ? $bootstrapPassword : 'password'),
                    'is_active' => true,
                ],
            );
        $administrator->syncRoles([RoleName::SystemAdministrator->value]);
        $productionAccounts?->apply();

        if (app()->environment('local')) {
            $this->call(LocalDevelopmentSeeder::class);
            $localAccountOverrides?->apply();
        }
    }
}
