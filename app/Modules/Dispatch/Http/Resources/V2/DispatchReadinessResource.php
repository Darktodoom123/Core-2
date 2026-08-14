<?php

namespace App\Modules\Dispatch\Http\Resources\V2;

use App\Modules\Dispatch\Data\DispatchReadinessBlocker;
use App\Modules\Dispatch\Data\DispatchReadinessProjection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DispatchReadinessProjection
 */
class DispatchReadinessResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var DispatchReadinessProjection $projection */
        $projection = $this->resource;

        return [
            'ready' => $projection->ready,
            'scheduled' => $projection->scheduled,
            'awaiting_approval' => $projection->awaitingApproval,
            'blocking_codes' => array_map(
                static fn (DispatchReadinessBlocker $b): string => $b->code->value,
                $projection->blockers
            ),
            'labels' => $projection->labels,
            'blockers' => $projection->blockerArrays(),
            'attempt_version' => $projection->attemptVersion,
            'plan_version' => $projection->planVersion,
            'plan_status' => $this->additional['plan_status'] ?? null,
        ];
    }
}
