<?php

namespace App\Platform\Gpt\Services;

use Carbon\CarbonImmutable;

final class DispatchAdviceQualityGate
{
    /** @param array<string, mixed> $payload
     * @param  array<string, mixed>  $context
     */
    public function hasSupportedClockTimes(array $payload, array $context): bool
    {
        $job = $context['job'] ?? [];
        $start = is_array($job) ? ($job['scheduled_start'] ?? null) : null;
        $end = is_array($job) ? ($job['scheduled_end'] ?? null) : null;
        $timezone = is_array($job) ? ($job['schedule_timezone'] ?? null) : null;
        $windowStart = is_string($start) ? CarbonImmutable::parse($start) : null;
        $windowEnd = is_string($end) ? CarbonImmutable::parse($end) : null;

        $text = json_encode($payload, JSON_THROW_ON_ERROR);
        preg_match_all('/(?<!\d)(?:[01]\d|2[0-3]):[0-5]\d(?!\d)/', $text, $matches);
        if ($matches[0] === []) {
            return true;
        }
        if ($windowStart === null || $windowEnd === null || ! is_string($timezone) || $timezone === '') {
            return false;
        }

        foreach ($matches[0] as $clock) {
            $onStartDay = CarbonImmutable::parse($windowStart->format('Y-m-d').' '.$clock, $timezone);
            $onEndDay = CarbonImmutable::parse($windowEnd->format('Y-m-d').' '.$clock, $timezone);
            if (! $onStartDay->betweenIncluded($windowStart, $windowEnd)
                && ! $onEndDay->betweenIncluded($windowStart, $windowEnd)) {
                return false;
            }
        }

        return true;
    }
}
