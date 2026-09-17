<?php

namespace App\Modules\Dispatch\Enums;

enum DelayReason: string
{
    // Transit specific
    case Traffic = 'traffic';
    case RoadClosure = 'road_closure';
    case LowClearance = 'low_clearance';
    case SiteAccessRestricted = 'site_access_restricted';

    // On-site specific
    case SiteNotReady = 'site_not_ready';
    case MaterialsUnavailable = 'materials_unavailable';
    case AwaitingClearance = 'awaiting_clearance';

    // Shared
    case Weather = 'weather';
    case EquipmentIssue = 'equipment_issue';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Traffic => 'Heavy Traffic / Escort Delay',
            self::RoadClosure => 'Road Closure / Route Barrier',
            self::LowClearance => 'Low Clearance or Route Restriction',
            self::SiteAccessRestricted => 'Site Access Restriction / Gate Queue',
            self::SiteNotReady => 'Site Not Ready',
            self::MaterialsUnavailable => 'Materials Unavailable',
            self::AwaitingClearance => 'Awaiting Instructions or Clearance',
            self::Weather => 'Weather Condition / Wind Hold',
            self::EquipmentIssue => 'Equipment Issue / Malfunction',
            self::Other => 'Other Operational Delay',
        };
    }

    /**
     * @return list<self>
     */
    public static function reasonsForContext(DelayContext $context): array
    {
        return match ($context) {
            DelayContext::Transit => [
                self::Traffic,
                self::RoadClosure,
                self::LowClearance,
                self::SiteAccessRestricted,
                self::Weather,
                self::EquipmentIssue,
                self::Other,
            ],
            DelayContext::OnSite => [
                self::SiteNotReady,
                self::MaterialsUnavailable,
                self::AwaitingClearance,
                self::Weather,
                self::EquipmentIssue,
                self::Other,
            ],
        };
    }

    public static function isValidForContext(string $reason, DelayContext $context): bool
    {
        $normalized = self::normalize($reason, $context);

        if ($normalized === null) {
            return false;
        }

        return in_array($normalized, self::reasonsForContext($context), true);
    }

    public static function normalize(string $value, DelayContext $context): ?self
    {
        $direct = self::tryFrom($value);
        if ($direct !== null) {
            return $direct;
        }

        // Fuzzy match common human strings from legacy clients or quick pills
        $lower = strtolower(trim($value));

        if (str_contains($lower, 'traffic') || str_contains($lower, 'escort')) {
            return self::Traffic;
        }

        if (str_contains($lower, 'road') || str_contains($lower, 'closure') || str_contains($lower, 'barrier')) {
            return self::RoadClosure;
        }

        if (str_contains($lower, 'clearance') || str_contains($lower, 'detour')) {
            return self::LowClearance;
        }

        if (str_contains($lower, 'gate') || str_contains($lower, 'access')) {
            return $context === DelayContext::Transit ? self::SiteAccessRestricted : self::SiteNotReady;
        }

        if (str_contains($lower, 'not ready') || str_contains($lower, 'prep')) {
            return self::SiteNotReady;
        }

        if (str_contains($lower, 'material') || str_contains($lower, 'concrete')) {
            return self::MaterialsUnavailable;
        }

        if (str_contains($lower, 'instruction') || str_contains($lower, 'awaiting')) {
            return self::AwaitingClearance;
        }

        if (str_contains($lower, 'weather') || str_contains($lower, 'wind') || str_contains($lower, 'rain')) {
            return self::Weather;
        }

        if (str_contains($lower, 'equipment') || str_contains($lower, 'machine') || str_contains($lower, 'malfunction')) {
            return self::EquipmentIssue;
        }

        if (str_contains($lower, 'other')) {
            return self::Other;
        }

        return null;
    }
}
