<?php

namespace App\Modules\Dispatch\Support;

use App\Modules\Dispatch\Models\DispatchJob;

/**
 * Dispatch desk link that opens the Schedule on a job's day with the job selected.
 */
final class DispatchScheduleUrl
{
    /**
     * @param  string|null  $day  Y-m-d day as the browser sees it; the job's
     *                            start in the app timezone is used when omitted.
     */
    public static function for(DispatchJob $job, ?string $day = null): string
    {
        $day ??= ($job->scheduled_start?->copy()->timezone((string) config('app.timezone')) ?? now())->toDateString();

        return '/?'.http_build_query([
            'view' => 'dispatch',
            'dispatch_view' => 'schedule',
            'dispatch_mode' => 'list',
            'dispatch_period' => 'day',
            'dispatch_date' => $day,
            'dispatch_job' => $job->id,
        ]);
    }
}
