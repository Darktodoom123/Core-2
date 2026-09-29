<?php

namespace Database\Seeders;

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;
use RuntimeException;

/**
 * Creates the production admin, manager, and operator logins from environment
 * settings, mirroring the local quick-login accounts without shared passwords.
 */
final class ProductionAccounts
{
    private const ROLES = [
        'admin' => RoleName::SystemAdministrator,
        'manager' => RoleName::OperationsManager,
        'operator' => RoleName::CraneOperator,
    ];

    private const MIN_PASSWORD_LENGTH = 12;

    /**
     * @param  array<string, array{name: string, email: string, password: string|null}>  $accounts  keyed by username
     */
    private function __construct(private readonly array $accounts) {}

    /**
     * Validates every configured account before anything is written.
     */
    public static function fromConfig(): self
    {
        $accounts = [];
        $configured = (array) config('auth.production_accounts', []);

        foreach (self::ROLES as $username => $role) {
            $settings = (array) ($configured[$username] ?? []);
            $email = self::filled($settings['email'] ?? null);
            if ($email === null) {
                continue;
            }

            $prefix = strtoupper($username);
            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                throw new InvalidArgumentException("{$prefix}_EMAIL must be a valid email address.");
            }
            $email = strtolower($email);
            if (in_array($email, array_column($accounts, 'email'), true)
                || User::query()->where('email', $email)->where('username', '!=', $username)->exists()) {
                throw new InvalidArgumentException("{$prefix}_EMAIL is already used by another account.");
            }

            $password = self::filled($settings['password'] ?? null);
            if ($username !== 'admin' && ($password === null || strlen($password) < self::MIN_PASSWORD_LENGTH)) {
                throw new RuntimeException("{$prefix}_PASSWORD must contain at least ".self::MIN_PASSWORD_LENGTH.' characters.');
            }

            $accounts[$username] = [
                'name' => self::filled($settings['name'] ?? null) ?? $role->label(),
                'email' => $email,
                'password' => $password,
            ];
        }

        return new self($accounts);
    }

    /**
     * Existing accounts keep their password; only name, email, and role are synced.
     */
    public function apply(): void
    {
        foreach ($this->accounts as $username => $account) {
            $user = User::query()->where('username', $username)->first();

            if ($user === null) {
                $user = User::query()->create([
                    'name' => $account['name'],
                    'username' => $username,
                    'email' => $account['email'],
                    'password' => Hash::make((string) $account['password']),
                    'email_verified_at' => now(),
                    'is_active' => true,
                ]);
            } else {
                $user->update(['name' => $account['name'], 'email' => $account['email']]);
            }

            $user->syncRoles([self::ROLES[$username]->value]);
        }
    }

    private static function filled(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
