<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchStatus: string
{
    case Draft = 'draft';
    case PendingApproval = 'pending_approval';
    case Scheduled = 'scheduled';
    case Dispatched = 'dispatched';
    case Accepted = 'accepted';
    case EnRoute = 'en_route';
    case Arrived = 'arrived';
    case Working = 'working';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::PendingApproval => 'Pending approval',
            self::Scheduled => 'Scheduled',
            self::Dispatched => 'Dispatched',
            self::Accepted => 'Accepted',
            self::EnRoute => 'En route',
            self::Arrived => 'Arrived',
            self::Working => 'Working',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    public function nextFieldStatus(): ?self
    {
        return match ($this) {
            self::Dispatched => self::Accepted,
            self::Accepted => self::EnRoute,
            self::EnRoute => self::Arrived,
            self::Arrived => self::Working,
            self::Working => self::Completed,
            default => null,
        };
    }

    public function fieldActionLabel(): ?string
    {
        return match ($this) {
            self::Dispatched => 'Accept job',
            self::Accepted => 'Start route',
            self::EnRoute => 'Mark arrived',
            self::Arrived => 'Start work',
            self::Working => 'Complete job',
            default => null,
        };
    }
}
