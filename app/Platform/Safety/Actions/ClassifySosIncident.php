<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Safety\Services\SosIncidentContextResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ClassifySosIncident
{
    public function __construct(
        private readonly SosIncidentContextResolver $context,
        private readonly RecordAuditEvent $audit,
    ) {}

    public function handle(User $actor, SosIncident $incident, SosIncidentCategory $category, ?int $assetId = null): SosIncident
    {
        return DB::transaction(function () use ($actor, $incident, $category, $assetId): SosIncident {
            $incident = SosIncident::query()->whereKey($incident->id)->lockForUpdate()->firstOrFail();
            if ($incident->status->isTerminal()) {
                throw ValidationException::withMessages(['status' => 'A terminal SOS incident cannot be reclassified.']);
            }

            $before = $incident->auditSnapshot();
            $context = $this->context->resolve($actor, $incident->dispatch_job_id, $assetId);
            if ($category === SosIncidentCategory::CriticalAssetMalfunction && $assetId === null) {
                throw ValidationException::withMessages(['operational_asset_id' => 'A currently assigned asset is required for this category.']);
            }

            $incident->forceFill([
                'category' => $category,
                'operational_asset_id' => $category === SosIncidentCategory::CriticalAssetMalfunction ? $assetId : null,
                'version' => $incident->version + 1,
            ])->save();
            $this->audit->handle($actor, $incident, 'safety.sos_classified', $before, $incident->auditSnapshot());

            return $incident->fresh();
        });
    }
}
