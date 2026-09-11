<?php

namespace App\Modules\Dispatch\Http\Resources\V2;

use App\Modules\Assignment\Http\Resources\V2\DispatchAssignmentOfferResource;
use App\Modules\Dispatch\Data\DispatchReadinessProjection;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DispatchJob
 */
class DispatchJobV2Resource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var DispatchJob $job */
        $job = $this->resource;

        /** @var DispatchExecutionAttempt|null $attempt */
        $attempt = $job->canonicalHandoff?->attempts()->latest('attempt_number')->first()
            ?? $job->currentAttempt
            ?? $job->attempts()->latest('attempt_number')->first();

        /** @var DispatchReadinessProjection|null $readiness */
        $readiness = $this->additional['readiness'] ?? null;

        /** @var User|null $actor */
        $actor = $request->user();

        $leadOffer = $attempt?->designatedLeadOffer;
        $leadUser = $leadOffer?->user;

        $plan = $attempt !== null ? ($attempt->activePlanVersion ?? $attempt->planVersions()->latest('version')->first()) : null;
        $offers = $attempt !== null ? $attempt->offers : collect();

        $isLead = $actor !== null && $leadUser !== null && $actor->id === $leadUser->id;
        $myOffer = $actor !== null ? $offers->firstWhere('user_id', $actor->id) : null;

        $statusValue = $attempt !== null
            ? $attempt->status->value
            : $job->status->value;

        $versionValue = $attempt !== null ? $attempt->version : $job->version;
        $scheduledStart = $attempt !== null ? ($attempt->scheduled_start ?? $job->scheduled_start) : $job->scheduled_start;
        $scheduledEnd = $attempt !== null ? ($attempt->scheduled_end ?? $job->scheduled_end) : $job->scheduled_end;

        return [
            'id' => $job->id,
            'reference' => $job->reference,
            'client' => $job->client,
            'title' => $job->title,
            'site' => $job->site,
            'site_notes' => $job->site_notes,
            'priority' => $job->priority->value,
            'status' => $statusValue,
            'version' => $versionValue,
            'scheduled_start' => $scheduledStart?->toISOString(),
            'scheduled_end' => $scheduledEnd?->toISOString(),
            'attempt_id' => $attempt?->id,
            'attempt_number' => $attempt !== null ? $attempt->attempt_number : 1,
            'is_archived' => $attempt !== null && $attempt->archived_at !== null,
            'archived_at' => $attempt?->archived_at?->toISOString(),
            'designated_lead' => $leadUser !== null ? [
                'offer_id' => $leadOffer->id,
                'user_id' => $leadUser->id,
                'user_name' => $leadUser->name,
                'status' => $leadOffer->status->value,
            ] : null,
            'readiness' => $readiness !== null ? (new DispatchReadinessResource($readiness))->resolve($request) : [
                'ready' => false,
                'blocking_codes' => [],
            ],
            'plan' => $plan !== null ? (new DispatchPlanVersionResource($plan))->resolve($request) : null,
            'offers' => DispatchAssignmentOfferResource::collection($offers)->resolve($request),
            'my_offer' => $myOffer !== null ? (new DispatchAssignmentOfferResource($myOffer))->resolve($request) : null,
            'capabilities' => [
                'is_designated_lead' => $isLead,
                'can_respond_offer' => $myOffer !== null && in_array($myOffer->status->value, ['offered', 'proposed'], true),
                'can_dispatch' => $actor?->can('dispatch_jobs.activate') ?? false,
                'can_progress' => $isLead || ($actor?->can('dispatch_jobs.emergency_override') ?? false),
                'can_cancel' => $actor?->can('dispatch_jobs.cancel') ?? false,
                'can_reopen' => $actor?->can('dispatch_jobs.reopen') ?? false,
                'can_archive' => $actor?->can('dispatch_jobs.archive') ?? false,
            ],
            'created_at' => $job->created_at?->toISOString(),
            'updated_at' => $job->updated_at?->toISOString(),
        ];
    }
}
