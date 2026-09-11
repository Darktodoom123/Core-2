<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Safety\Models\ToolboxMeeting;
use Generator;

final class CshpSafeManHoursExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::CshpSafeManHours;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::ReportsViewAll->value)
            || $actor->can(PermissionName::SafetyTbmSubmit->value)
            || $actor->can(PermissionName::SafetyTbmCoSign->value);
    }

    public function headers(): array
    {
        return [
            'TBM Reference',
            'Project Site',
            'Toolbox Topic',
            'Workers Present Count',
            'Lead Foreman',
            'Safety Officer Co-Signer',
            'Status',
            'DOLE Compliance Audit Hash',
            'Conducted At',
        ];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = $this->applyDateFilters(
            ToolboxMeeting::query()->with(['conductor', 'safetyOfficer']),
            $filters
        );

        /** @var ToolboxMeeting $tbm */
        foreach ($query->orderByDesc('id')->lazyById(200) as $tbm) {
            yield [
                $tbm->audit_hash ?? "TBM-{$tbm->id}",
                $tbm->project_site,
                $tbm->topic_title,
                (int) $tbm->attendee_count,
                $tbm->conductor !== null ? $tbm->conductor->name : 'Foreman Desk',
                $tbm->safetyOfficer !== null ? $tbm->safetyOfficer->name : ($tbm->safety_officer_signed_at !== null ? 'Verified SO' : 'Pending SO Sign-off'),
                $tbm->safety_officer_signed_at !== null ? 'CO-SIGNED & AUDITED' : 'SUBMITTED',
                $tbm->audit_hash ?? 'N/A',
                $tbm->created_at->toIso8601String(),
            ];
        }
    }
}
