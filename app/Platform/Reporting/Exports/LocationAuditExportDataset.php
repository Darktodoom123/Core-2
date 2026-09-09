<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use Generator;

final class LocationAuditExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::LocationAudit;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::TrackingViewAll->value);
    }

    public function headers(): array
    {
        return ['Update ID', 'User ID', 'Asset ID', 'Dispatch ID', 'Sharing Enabled', 'Captured At', 'Received At'];
    }

    public function rows(User $actor, array $filters): Generator
    {
        /** @var TrackingClientInterface $trackingClient */
        $trackingClient = app(TrackingClientInterface::class);

        $queryFilters = $filters;
        if (! $actor->can(PermissionName::TrackingViewAll->value)) {
            $queryFilters['user_id'] = $actor->id;
        }
        $queryFilters['order_by'] = $filters['order_by'] ?? 'id';
        $queryFilters['order_direction'] = $filters['order_direction'] ?? 'asc';

        $samples = $trackingClient->queryLocationHistory($queryFilters);

        foreach ($samples as $update) {
            yield [
                $update->id,
                $update->userId,
                $update->operationalAssetId,
                $update->dispatchJobId,
                $update->sharingEnabled ? 'yes' : 'no',
                $update->capturedAt?->toIso8601String(),
                $update->receivedAt?->toIso8601String(),
            ];
        }
    }
}
