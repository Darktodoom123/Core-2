<?php

namespace App\Modules\Dispatch\Contracts;

use App\Modules\Dispatch\Data\DispatchScheduleWindow;

interface DispatchScheduleReader
{
    /**
     * @param  array<int, int|string>  $dispatchJobIds
     * @return list<DispatchScheduleWindow>
     */
    public function windowsForJobIds(array $dispatchJobIds): array;
}
