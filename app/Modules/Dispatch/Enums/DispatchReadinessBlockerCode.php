<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchReadinessBlockerCode: string
{
    case MissingSchedule = 'missing_schedule';
    case MissingMandatoryAssignment = 'missing_mandatory_assignment';
    case PendingMandatoryAcceptance = 'pending_mandatory_acceptance';
    case NoDesignatedLead = 'no_designated_lead';
    case LeadNotAccepted = 'lead_not_accepted';
    case ApprovalRequired = 'approval_required';
    case StalePlanApproval = 'stale_plan_approval';
    case AssetUnavailable = 'asset_unavailable';
    case AssetUnsafe = 'asset_unsafe';
    case SourceNotReady = 'source_not_ready';
    case ArchivedRecord = 'archived_record';
    case ConcurrencyConflict = 'concurrency_conflict';

    public function order(): int
    {
        return match ($this) {
            self::MissingSchedule => 10,
            self::MissingMandatoryAssignment => 20,
            self::PendingMandatoryAcceptance => 30,
            self::NoDesignatedLead => 40,
            self::LeadNotAccepted => 50,
            self::ApprovalRequired => 60,
            self::StalePlanApproval => 70,
            self::AssetUnavailable => 80,
            self::AssetUnsafe => 90,
            self::SourceNotReady => 100,
            self::ArchivedRecord => 110,
            self::ConcurrencyConflict => 120,
        };
    }
}
