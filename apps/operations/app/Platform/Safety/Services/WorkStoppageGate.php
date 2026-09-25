<?php

namespace App\Platform\Safety\Services;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Illuminate\Validation\ValidationException;

final class WorkStoppageGate
{
    public function assertDispatchMayProgress(DispatchJob $job): void
    {
        $notice = WorkStoppageNotice::query()
            ->where('is_active', true)
            ->where('project_site', $job->site)
            ->latest('id')
            ->first(['notice_number']);

        if ($notice === null) {
            return;
        }

        throw ValidationException::withMessages([
            'safety' => "Work is paused while stop-work order {$notice->notice_number} is active for this site. Contact an Operations Manager before continuing.",
        ]);
    }
}
