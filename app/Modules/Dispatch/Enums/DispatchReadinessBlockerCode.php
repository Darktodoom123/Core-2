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
    case LeadIneligible = 'lead_ineligible';
    case PersonnelRoleIneligible = 'personnel_role_ineligible';
    case PersonnelAccountInactive = 'personnel_account_inactive';
    case PersonnelSuspended = 'personnel_suspended';
    case PersonnelUnavailable = 'personnel_unavailable';
    case PersonnelCredentialMissing = 'personnel_credential_missing';
    case PersonnelCredentialInvalid = 'personnel_credential_invalid';
    case PersonnelConflict = 'personnel_conflict';
    case AssetConflict = 'asset_conflict';
    case SafetyOfficerPermitRequired = 'safety_officer_permit_required';
    case ActiveWorkStoppageOrder = 'active_work_stoppage_order';

    public function order(): int
    {
        return match ($this) {
            self::ActiveWorkStoppageOrder => 5,
            self::SafetyOfficerPermitRequired => 8,
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
            self::LeadIneligible => 130,
            self::PersonnelRoleIneligible => 140,
            self::PersonnelAccountInactive => 150,
            self::PersonnelSuspended => 160,
            self::PersonnelUnavailable => 170,
            self::PersonnelCredentialMissing => 180,
            self::PersonnelCredentialInvalid => 190,
            self::PersonnelConflict => 200,
            self::AssetConflict => 210,
        };
    }
}
