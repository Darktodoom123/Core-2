<?php

namespace Database\Seeders\Development;

use App\Platform\Identity\Models\User;
use InvalidArgumentException;

/**
 * Applies a developer's untracked name/email overrides (from .env) to the
 * local quick-login accounts, so personal details never land in the repository.
 */
final class LocalAccountOverrides
{
    /**
     * @param  array<string, array{name?: string, email?: string}>  $changes  keyed by username
     */
    private function __construct(private readonly array $changes) {}

    public static function fromConfig(): self
    {
        $changes = [];

        foreach ((array) config('auth.local_account_overrides', []) as $username => $override) {
            $name = self::filled($override['name'] ?? null);
            $email = self::filled($override['email'] ?? null);

            if ($email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                throw new InvalidArgumentException(sprintf('LOCAL_%s_EMAIL must be a valid email address.', strtoupper((string) $username)));
            }

            $change = array_filter(['name' => $name, 'email' => $email], fn (?string $value): bool => $value !== null);

            if ($change !== []) {
                $changes[(string) $username] = $change;
            }
        }

        return new self($changes);
    }

    /**
     * Point renamed accounts back at their fixture emails so the email-keyed
     * fixture seeders update them on a re-seed instead of inserting duplicates.
     */
    public function restoreFixtureEmails(): void
    {
        foreach (LocalDevelopmentSeeder::accounts() as $account) {
            User::query()
                ->where('username', $account['username'])
                ->where('email', '!=', $account['email'])
                ->update(['email' => $account['email']]);
        }
    }

    public function apply(): void
    {
        foreach ($this->changes as $username => $change) {
            User::query()->where('username', $username)->update($change);
        }
    }

    private static function filled(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
