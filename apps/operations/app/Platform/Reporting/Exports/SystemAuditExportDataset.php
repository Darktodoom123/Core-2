<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use Generator;

final class SystemAuditExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::SystemAudit;
    }

    public function authorize(User $actor): bool
    {
        return $actor->hasRole(RoleName::SystemAdministrator->value)
            && $actor->can(PermissionName::AuditView->value);
    }

    public function headers(): array
    {
        return ['Event ID', 'Actor ID', 'Action', 'Subject Type', 'Subject ID', 'Occurred At'];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = $this->applyDateFilters(AuditEvent::query(), $filters, 'occurred_at');
        foreach ($query->orderBy('id')->lazyById(500) as $event) {
            yield [$event->id, $event->actor_id, $event->action, $event->subject_type, $event->subject_id, $event->occurred_at?->toIso8601String()];
        }
    }
}
