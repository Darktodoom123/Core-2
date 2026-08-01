<?php

namespace App\Modules\Assignment;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Assignment\Policies\DispatchPersonnelAssignmentPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class AssignmentServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(DispatchPersonnelAssignment::class, DispatchPersonnelAssignmentPolicy::class);
    }
}
