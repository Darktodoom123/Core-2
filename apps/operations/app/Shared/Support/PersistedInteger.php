<?php

namespace App\Shared\Support;

use Illuminate\Validation\ValidationException;

final class PersistedInteger
{
    public const int MAX = 2_147_483_647;

    public static function checkedAdd(int $left, int $right, string $validationKey): int
    {
        if ($left < 0 || $right < 0 || $left > self::MAX - $right) {
            throw ValidationException::withMessages([
                $validationKey => 'The calculated value exceeds the maximum supported value.',
            ]);
        }

        return $left + $right;
    }

    public static function checkedMultiply(int $left, int $right, string $validationKey): int
    {
        if ($left < 0 || $right < 0 || ($left !== 0 && $right > intdiv(self::MAX, $left))) {
            throw ValidationException::withMessages([
                $validationKey => 'The calculated value exceeds the maximum supported value.',
            ]);
        }

        return $left * $right;
    }
}
