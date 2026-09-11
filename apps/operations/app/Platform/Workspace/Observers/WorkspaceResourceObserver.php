<?php

namespace App\Platform\Workspace\Observers;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

final class WorkspaceResourceObserver
{
    public function created(Model $model): void
    {
        $this->broadcast($model, 'created');
    }

    public function updated(Model $model): void
    {
        $this->broadcast($model, 'updated');
    }

    public function deleted(Model $model): void
    {
        $this->broadcast($model, 'deleted');
    }

    private function broadcast(Model $model, string $action): void
    {
        $resourceType = $this->resourceType($model);

        if ($resourceType === null) {
            return;
        }

        DB::afterCommit(static function () use ($resourceType, $action): void {
            WorkspaceUpdated::dispatch($resourceType, $action);
        });
    }

    private function resourceType(Model $model): ?string
    {
        return match (true) {
            $model instanceof DispatchJob,
            $model instanceof DispatchAssetAssignment,
            $model instanceof DispatchPersonnelAssignment => 'job',
            $model instanceof ApprovalRequest => 'approval',
            $model instanceof FuelRequest => 'fuel',
            $model instanceof OperationalAsset => 'asset',
            default => null,
        };
    }
}
