<?php

namespace App\Platform\Safety\Http\Resources;

use App\Platform\Safety\Models\SosIncident;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SosIncident */
final class SosIncidentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'category' => $this->category->value,
            'category_label' => $this->category->label(),
            'worker_note' => $this->worker_note,
            'received_at' => $this->received_at->toIso8601String(),
            'escalation_due_at' => $this->escalation_due_at->toIso8601String(),
            'acknowledged_at' => $this->acknowledged_at?->toIso8601String(),
            'acknowledged_by' => $this->when($this->relationLoaded('acknowledgedBy') && $this->acknowledgedBy !== null, fn (): array => [
                'id' => $this->acknowledgedBy->id,
                'name' => $this->acknowledgedBy->name,
            ]),
            'escalated_at' => $this->escalated_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolution_code' => $this->resolution_code,
            'resolution_notes' => $this->resolution_notes,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $this->cancellation_reason,
            'dispatch' => $this->when($this->relationLoaded('dispatchJob') && $this->dispatchJob !== null, fn (): array => [
                'id' => $this->dispatchJob->id,
                'reference' => $this->dispatchJob->reference,
                'title' => $this->dispatchJob->title,
            ]),
            'asset' => $this->when($this->relationLoaded('operationalAsset') && $this->operationalAsset !== null, fn (): array => [
                'id' => $this->operationalAsset->id,
                'code' => $this->operationalAsset->code,
                'name' => $this->operationalAsset->name,
            ]),
            'location' => $this->when($this->location_pruned_at === null && $this->location_captured_at !== null, [
                'latitude' => $this->latitude,
                'longitude' => $this->longitude,
                'accuracy_metres' => $this->accuracy_metres,
                'captured_at' => $this->location_captured_at?->toIso8601String(),
            ]),
            'location_pruned_at' => $this->location_pruned_at?->toIso8601String(),
            'version' => $this->version,
        ];
    }
}
