<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Safety\Models\SiteHazardTicket;
use Generator;

final class DoleWairExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::DoleWair;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::ReportsViewAll->value)
            || $actor->can(PermissionName::SafetyHazardReport->value);
    }

    public function headers(): array
    {
        return [
            'Ticket Code',
            'Project Site',
            'Category',
            'Severity Level',
            'Hazard Observation',
            'Corrective Action Required (CAPA)',
            'Work Stoppage Triggered',
            'Status',
            'Reported By',
            'Reported At',
        ];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = $this->applyDateFilters(SiteHazardTicket::query()->with('reporter'), $filters);

        /** @var SiteHazardTicket $ticket */
        foreach ($query->orderByDesc('id')->lazyById(200) as $ticket) {
            yield [
                $ticket->ticket_code,
                $ticket->project_site,
                strtoupper(str_replace('_', ' ', (string) $ticket->category)),
                strtoupper(str_replace('_', ' ', (string) $ticket->severity)),
                $ticket->description,
                $ticket->corrective_action_required ?? 'N/A',
                $ticket->work_stoppage_issued ? 'YES (RA 11058)' : 'NO',
                strtoupper($ticket->status),
                $ticket->reporter !== null ? $ticket->reporter->name : 'Safety Desk',
                $ticket->created_at->toIso8601String(),
            ];
        }
    }
}
