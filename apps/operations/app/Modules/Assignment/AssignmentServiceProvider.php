<?php

namespace App\Modules\Assignment;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Assignment\Policies\DispatchAssignmentOfferPolicy;
use App\Modules\Assignment\Policies\DispatchPersonnelAssignmentPolicy;
use App\Modules\Assignment\Services\DispatchAssetUsageConflictChecker;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class AssignmentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->tag(DispatchAssetUsageConflictChecker::class, AssetUsageConflictChecker::TAG);
    }

    public function boot(): void
    {
        Gate::policy(DispatchPersonnelAssignment::class, DispatchPersonnelAssignmentPolicy::class);
        Gate::policy(DispatchAssignmentOffer::class, DispatchAssignmentOfferPolicy::class);
    }
}
