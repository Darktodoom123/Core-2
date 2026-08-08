<?php

namespace App\Modules\Fuel\Policies;

use App\Modules\Fuel\Models\FuelLog;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Gate;

final class FuelLogPolicy
{
    public function view(User $user, FuelLog $fuelLog): bool
    {
        return Gate::forUser($user)->allows('view', $fuelLog->request);
    }
}
