<?php

namespace Database\Seeders;

use App\Enums\RoleName;
use App\Models\User;
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
        $this->call(RolePermissionSeeder::class);

        $bootstrapPassword = config('auth.bootstrap_admin_password');

        if (app()->environment('production') && (! is_string($bootstrapPassword) || strlen($bootstrapPassword) < 12)) {
            throw new RuntimeException('ADMIN_PASSWORD must contain at least 12 characters when seeding production.');
        }

        $administrator = User::query()->firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'System Administrator',
                'email_verified_at' => now(),
                'password' => Hash::make(is_string($bootstrapPassword) ? $bootstrapPassword : 'password'),
                'is_active' => true,
            ],
        );
        $administrator->syncRoles([RoleName::SystemAdministrator->value]);

        if (app()->environment('local')) {
            $this->call(LocalDevelopmentSeeder::class);
        }
    }
}
