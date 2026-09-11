<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Builder;

final class MobileFuelContexts
{
    /** @return Builder<DispatchJob> */
    public function jobs(User $actor): Builder
    {
        $query = DispatchJob::query();
        if (! $actor->can(PermissionName::FuelViewAll->value)) {
            $query->whereIn('id', DispatchPersonnelAssignment::query()->where('user_id', $actor->id)->active()->select('dispatch_job_id'));
        }

        return $query;
    }

    /** @return Builder<OperationalAsset> */
    public function assets(User $actor): Builder
    {
        $query = OperationalAsset::query();
        if (! $actor->can(PermissionName::FuelViewAll->value)) {
            $query->whereIn('id', DispatchAssetAssignment::query()
                ->active()->whereIn('dispatch_job_id', $this->jobs($actor)->select('id'))->select('operational_asset_id'));
        }

        return $query;
    }
}
