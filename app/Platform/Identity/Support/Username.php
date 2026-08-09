<?php

namespace App\Platform\Identity\Support;

use Illuminate\Support\Str;

final class Username
{
    public const int MIN_LENGTH = 3;

    public const int MAX_LENGTH = 50;

    public const string PATTERN = '/\A[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]\z/';

    public static function normalize(?string $value): string
    {
        return strtolower(trim((string) $value));
    }

    public static function isValid(string $value): bool
    {
        return preg_match(self::PATTERN, $value) === 1;
    }

    public static function pattern(): string
    {
        return self::PATTERN;
    }

    /** @return list<string> */
    public static function validationRules(): array
    {
        return ['string', 'min:'.self::MIN_LENGTH, 'max:'.self::MAX_LENGTH, 'regex:'.self::PATTERN];
    }

    public static function fromEmail(string $email, ?int $userId = null): string
    {
        $localPart = Str::ascii(explode('@', self::normalize($email), 2)[0]);
        $candidate = preg_replace('/[^a-z0-9._-]+/', '-', $localPart) ?? '';

        return self::boundedBase($candidate, $userId ?? 1);
    }

    /**
     * @param  array<string, true>  $used
     */
    public static function fromEmailWithCollision(string $email, int $userId, array &$used): string
    {
        $base = self::fromEmail($email, $userId);
        $candidate = $base;
        $suffix = 2;

        while (isset($used[$candidate])) {
            $candidate = self::withSuffix($base, $suffix);
            $suffix++;
        }

        $used[$candidate] = true;

        return $candidate;
    }

    public static function withSuffix(string $base, int $suffix): string
    {
        $suffixValue = '-'.$suffix;
        $prefix = rtrim(substr($base, 0, max(1, self::MAX_LENGTH - strlen($suffixValue))), '._-');

        if ($prefix === '' || ! ctype_alnum($prefix[0])) {
            $prefix = 'user';
        }

        $candidate = substr($prefix.$suffixValue, 0, self::MAX_LENGTH);

        return self::isValid($candidate) ? $candidate : self::fallback($suffix);
    }

    private static function boundedBase(string $candidate, int $userId): string
    {
        $candidate = trim($candidate, '._-');
        $candidate = rtrim(substr($candidate, 0, self::MAX_LENGTH), '._-');

        return self::isValid($candidate) ? $candidate : self::fallback($userId);
    }

    private static function fallback(int $value): string
    {
        return 'user-'.max(1, $value);
    }
}
