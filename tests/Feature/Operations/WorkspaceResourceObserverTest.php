<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use App\Platform\Workspace\Observers\WorkspaceResourceObserver;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Facades\Event;

it('maps operational resource mutations to workspace update events', function (string $modelClass, string $resourceType): void {
    Event::fake([WorkspaceUpdated::class]);

    app(WorkspaceResourceObserver::class)->updated(new $modelClass);

    Event::assertDispatched(WorkspaceUpdated::class, function (WorkspaceUpdated $event) use ($resourceType): bool {
        return $event->resourceType === $resourceType
            && $event->action === 'updated';
    });
})->with([
    'dispatch jobs' => [DispatchJob::class, 'job'],
    'asset assignments' => [DispatchAssetAssignment::class, 'job'],
    'personnel assignments' => [DispatchPersonnelAssignment::class, 'job'],
    'approvals' => [ApprovalRequest::class, 'approval'],
    'fuel requests' => [FuelRequest::class, 'fuel'],
    'operational assets' => [OperationalAsset::class, 'asset'],
]);
