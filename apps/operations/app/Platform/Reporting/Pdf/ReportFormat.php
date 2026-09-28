<?php

namespace App\Platform\Reporting\Pdf;

use App\Platform\Reporting\AssetWeekly\AssetWeeklyReportBuilder;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/** Display formatting for PDF report views. Missing values render as an em dash. */
final class ReportFormat
{
    public const EMPTY = '—';

    public static function dateTime(CarbonInterface|string|null $value): string
    {
        return self::carbon($value)?->format('M j, Y g:i A') ?? self::EMPTY;
    }

    public static function shortDateTime(CarbonInterface|string|null $value): string
    {
        return self::carbon($value)?->format('D M j, g:i A') ?? self::EMPTY;
    }

    public static function peso(int|float|string|null $amount): string
    {
        return $amount === null || $amount === '' ? self::EMPTY : '₱'.number_format((float) $amount, 2);
    }

    public static function number(int|float|string|null $value, int $decimals = 2, string $suffix = ''): string
    {
        return $value === null || $value === '' ? self::EMPTY : number_format((float) $value, $decimals).$suffix;
    }

    public static function hours(int|float|null $minutes): string
    {
        if ($minutes === null) {
            return self::EMPTY;
        }

        $minutes = (int) round($minutes);
        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;

        return $hours === 0 ? "{$rest}m" : "{$hours}h {$rest}m";
    }

    public static function text(?string $value): string
    {
        return $value === null || trim($value) === '' ? self::EMPTY : $value;
    }

    private static function carbon(CarbonInterface|string|null $value): ?CarbonInterface
    {
        if ($value === null || $value === '') {
            return null;
        }

        $carbon = $value instanceof CarbonInterface ? $value : CarbonImmutable::parse($value);

        return $carbon->copy()->setTimezone(AssetWeeklyReportBuilder::TIMEZONE);
    }
}
