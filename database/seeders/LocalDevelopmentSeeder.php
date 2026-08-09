<?php

namespace Database\Seeders;

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class LocalDevelopmentSeeder extends Seeder
{
    /**
     * Seed one quick-login account for each operational role with location updates.
     */
    public function run(): void
    {
        foreach (self::accounts() as $index => $account) {
            $user = User::query()->updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'username' => $account['username'],
                    'email_verified_at' => now(),
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'suspended_at' => null,
                ],
            );

            $user->syncRoles([$account['role']->value]);

            DB::table('location_updates')->updateOrInsert(
                ['user_id' => $user->id],
                [
                    'latitude' => 3.1390 + ($index * 0.012),
                    'longitude' => 101.6869 + ($index * 0.015),
                    'accuracy_metres' => 5.0,
                    'sharing_enabled' => true,
                    'source' => 'mobile',
                    'captured_at' => now(),
                    'received_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }

    /**
     * @return list<array{name: string, username: string, email: string, role: RoleName}>
     */
    public static function accounts(): array
    {
        return [
            [
                'name' => 'Dev Dispatcher',
                'username' => Username::fromEmail('dispatcher@example.com'),
                'email' => 'dispatcher@example.com',
                'role' => RoleName::Dispatcher,
            ],
            [
                'name' => 'Dev Operations Manager',
                'username' => Username::fromEmail('manager@example.com'),
                'email' => 'manager@example.com',
                'role' => RoleName::OperationsManager,
            ],
            [
                'name' => 'Dev Driver',
                'username' => Username::fromEmail('driver@example.com'),
                'email' => 'driver@example.com',
                'role' => RoleName::Driver,
            ],
            [
                'name' => 'Dev Crane Operator',
                'username' => Username::fromEmail('operator@example.com'),
                'email' => 'operator@example.com',
                'role' => RoleName::CraneOperator,
            ],
            [
                'name' => 'Dev Field Technician',
                'username' => Username::fromEmail('technician@example.com'),
                'email' => 'technician@example.com',
                'role' => RoleName::FieldTechnician,
            ],
        ];
    }
}
