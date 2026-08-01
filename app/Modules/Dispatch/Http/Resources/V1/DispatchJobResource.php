<?php

namespace App\Modules\Dispatch\Http\Resources\V1;

use App\Modules\Assignment\Http\Resources\V1\DispatchAssetAssignmentResource;
use App\Modules\Assignment\Http\Resources\V1\DispatchPersonnelAssignmentResource;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\ViewModels\DispatchFieldProgressionViewModel;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/** @mixin DispatchJob */
final class DispatchJobResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $now = now();

        $myAssignment = $user !== null
            ? $this->personnelAssignments
                ->first(fn (DispatchPersonnelAssignment $a): bool => $a->user_id === $user->id
                    && ($a->active_until === null || $a->active_until->gt($now)))
            : null;

        $canUpdateOwnStatus = $user !== null && Gate::forUser($user)->allows('updateOwnStatus', $this->resource);
        $canRespondAssignment = $myAssignment !== null && Gate::forUser($user)->allows('respond', $myAssignment);
        $canShareLocation = $user !== null && $user->can(PermissionName::TrackingShareOwn->value);

        $personnelAssignments = $this->whenLoaded('personnelAssignments', function () use ($user) {
            $assignments = $this->personnelAssignments;

            if ($user === null || ! $user->can(PermissionName::DispatchViewAll->value)) {
                $assignments = $assignments->where('user_id', $user?->id)->values();
            }

            return DispatchPersonnelAssignmentResource::collection($assignments);
        });

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'client' => $this->client,
            'title' => $this->title,
            'site' => $this->site,
            'site_notes' => $this->site_notes,
            'scheduled_start' => $this->scheduled_start?->toIso8601String(),
            'scheduled_end' => $this->scheduled_end?->toIso8601String(),
            'priority' => [
                'value' => $this->priority->value,
                'label' => $this->priority->label(),
            ],
            'status' => [
                'value' => $this->status->value,
                'label' => $this->status->label(),
            ],
            'version' => $this->version,
            'requirements' => $this->requirements,
            'my_assignment' => $myAssignment !== null ? [
                'id' => $myAssignment->id,
                'response_status' => $myAssignment->response_status->value,
                'response_status_label' => $myAssignment->response_status->label(),
                'responded_at' => $myAssignment->responded_at?->toIso8601String(),
                'response_reason' => $myAssignment->response_reason,
                'assigned_at' => $myAssignment->created_at?->toIso8601String(),
            ] : null,
            'personnel_assignments' => $personnelAssignments,
            'asset_assignments' => DispatchAssetAssignmentResource::collection($this->whenLoaded('assetAssignments')),
            'progression' => $canUpdateOwnStatus ? DispatchFieldProgressionViewModel::make($this->resource) : null,
            'capabilities' => [
                'can_respond' => $canRespondAssignment,
                'can_update_status' => $canUpdateOwnStatus,
                'can_share_location' => $canShareLocation,
            ],
        ];
    }
}
