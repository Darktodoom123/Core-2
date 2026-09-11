<?php

namespace App\Platform\Safety\Enums;

enum SosResolutionCode: string
{
    case WorkerSafe = 'worker_safe';
    case MedicalAssistance = 'medical_assistance';
    case EmergencyServicesContacted = 'emergency_services_contacted';
    case AssetSecured = 'asset_secured';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::WorkerSafe => 'Worker safe',
            self::MedicalAssistance => 'Medical assistance',
            self::EmergencyServicesContacted => 'Emergency services contacted',
            self::AssetSecured => 'Asset secured',
            self::Other => 'Other',
        };
    }
}
