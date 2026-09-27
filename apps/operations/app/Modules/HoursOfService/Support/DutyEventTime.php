<?php

namespace App\Modules\HoursOfService\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * When a duty event happened, as reported by the phone. Phone clocks drift a
 * little from the server's, so a timestamp slightly ahead of server time is
 * recorded at server time instead of rejecting a live tap. Anything further
 * ahead is still refused.
 */
final class DutyEventTime
{
    public const MAX_CLOCK_SKEW_SECONDS = 120;

    public static function latestAccepted(): string
    {
        return Carbon::now()->addSeconds(self::MAX_CLOCK_SKEW_SECONDS)->toIso8601String();
    }

    public static function resolve(?CarbonInterface $occurredAt, CarbonInterface $now): Carbon
    {
        if ($occurredAt === null) {
            return Carbon::instance($now);
        }

        $eventAt = Carbon::instance($occurredAt);

        if ($eventAt->gt($now->copy()->addSeconds(self::MAX_CLOCK_SKEW_SECONDS))) {
            throw ValidationException::withMessages([
                'occurred_at' => 'The duty event cannot occur in the future.',
            ]);
        }

        return $eventAt->gt($now) ? Carbon::instance($now) : $eventAt;
    }
}
