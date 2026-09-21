<?php

namespace App\Modules\Fleet\Enums;

enum AssetDocumentCategory: string
{
    case RoadPermits = 'road_permits';
    case LoadTestCertificates = 'load_test_certs';
    case Insurance = 'insurance';
    case Registrations = 'registrations';
    case EmissionCertificates = 'emission_certs';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::RoadPermits => 'Road Transit Permit',
            self::LoadTestCertificates => 'Load Test Certificate',
            self::Insurance => 'Comprehensive / Third-Party Insurance',
            self::Registrations => 'Registration / LTO',
            self::EmissionCertificates => 'Smoke Emission Clearance',
            self::Other => 'Other Regulatory Permit',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $category): string => $category->value, self::cases());
    }
}
