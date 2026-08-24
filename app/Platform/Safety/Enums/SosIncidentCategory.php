<?php

namespace App\Platform\Safety\Enums;

enum SosIncidentCategory: string
{
    case Unclassified = 'unclassified';
    case VehicularAccident = 'vehicular_accident';
    case SiteAccident = 'site_accident';
    case CriticalAssetMalfunction = 'critical_asset_malfunction';
    case OtherImmediateDanger = 'other_immediate_danger';

    public function label(): string
    {
        return match ($this) {
            self::Unclassified => 'Unclassified',
            self::VehicularAccident => 'Vehicular accident',
            self::SiteAccident => 'Site accident',
            self::CriticalAssetMalfunction => 'Critical asset malfunction',
            self::OtherImmediateDanger => 'Other immediate danger',
        };
    }
}
