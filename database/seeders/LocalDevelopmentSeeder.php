<?php

namespace Database\Seeders;

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

final class LocalDevelopmentSeeder extends Seeder
{
    /**
     * Seed one quick-login account for each operational role.
     */
    public function run(): void
    {
        foreach (self::accounts() as $account) {
            $user = User::query()->updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'email_verified_at' => now(),
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'suspended_at' => null,
                ],
            );

            $user->syncRoles([$account['role']->value]);
        }
    }

    /**
     * @return list<array{name: string, email: string, role: RoleName}>
     */
    public static function accounts(): array
    {
        return [
            [
                'name' => 'Dev Dispatcher',
                'email' => 'dispatcher@example.com',
                'role' => RoleName::Dispatcher,
            ],
            [
                'name' => 'Dev Operations Manager',
                'email' => 'manager@example.com',
                'role' => RoleName::OperationsManager,
            ],
            [
                'name' => 'Dev Driver',
                'email' => 'driver@example.com',
                'role' => RoleName::Driver,
            ],
            [
                'name' => 'Dev Crane Operator',
                'email' => 'operator@example.com',
                'role' => RoleName::CraneOperator,
            ],
            [
                'name' => 'Dev Field Technician',
                'email' => 'technician@example.com',
                'role' => RoleName::FieldTechnician,
            ],
        ];
    }
}
