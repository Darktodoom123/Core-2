<?php

namespace App\Shared\Assets\Enums;

enum AssetCategory: string
{
    case TowerCranes = 'tower_cranes';
    case MobileCranes = 'mobile_cranes';
    case HeavyEquipment = 'heavy_equipment';
    case Transport = 'transport';
    case Other = 'other';

    public static function fromAsset(string $kind, ?string $subtype = null): self
    {
        $kind = preg_replace('/[_-]+/u', ' ', mb_strtolower(trim($kind))) ?? '';
        $subtype = preg_replace('/[_-]+/u', ' ', mb_strtolower(trim($subtype ?? ''))) ?? '';

        if (
            $kind === 'tower crane'
            || str_contains($kind, 'tower crane')
            || str_contains($subtype, 'tower crane')
        ) {
            return self::TowerCranes;
        }

        foreach (['equipment', 'excavator', 'loader', 'forklift', 'manlift', 'backhoe', 'dozer', 'grader', 'skid steer'] as $term) {
            if (str_contains($kind, $term) || str_contains($subtype, $term)) {
                return self::HeavyEquipment;
            }
        }

        if (str_contains($kind, 'crane') || str_contains($subtype, 'crane')) {
            return self::MobileCranes;
        }

        if (
            str_contains($kind, 'truck')
            || str_contains($kind, 'vehicle')
            || str_contains($kind, 'trailer')
            || str_contains($subtype, 'truck')
            || str_contains($subtype, 'trailer')
        ) {
            return self::Transport;
        }

        return self::Other;
    }

    public function label(): string
    {
        return match ($this) {
            self::TowerCranes => 'Tower crane',
            self::MobileCranes => 'Mobile crane',
            self::HeavyEquipment => 'Heavy equipment',
            self::Transport => 'Transport',
            self::Other => 'Other asset',
        };
    }
}
