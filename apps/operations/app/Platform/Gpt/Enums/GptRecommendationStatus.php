<?php

namespace App\Platform\Gpt\Enums;

enum GptRecommendationStatus: string
{
    case Draft = 'draft';
    case Processing = 'processing';
    case PendingReview = 'pending_review';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Failed = 'failed';
    case Expired = 'expired';
    case Stale = 'stale';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => in_array($next, [self::Processing, self::Rejected, self::Failed], true),
            self::Processing => in_array($next, [self::PendingReview, self::Rejected, self::Failed], true),
            self::PendingReview => in_array($next, [self::Accepted, self::Rejected, self::Expired, self::Stale], true),
            self::Accepted, self::Rejected, self::Failed, self::Expired, self::Stale => false,
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Accepted, self::Rejected, self::Failed, self::Expired, self::Stale], true);
    }
}
