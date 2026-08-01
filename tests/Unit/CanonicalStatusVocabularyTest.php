<?php

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Shared\Assets\Enums\AssetStatus;

it('publishes the canonical operational status vocabulary and labels', function () {
    expect(enumVocabulary(DispatchStatus::cases()))->toBe([
        'draft' => 'Draft',
        'pending_approval' => 'Pending approval',
        'scheduled' => 'Scheduled',
        'dispatched' => 'Dispatched',
        'accepted' => 'Accepted',
        'en_route' => 'En route',
        'arrived' => 'Arrived',
        'working' => 'Working',
        'completed' => 'Completed',
        'cancelled' => 'Cancelled',
    ])->and(enumVocabulary(FuelRequestStatus::cases()))->toBe([
        'submitted' => 'Submitted',
        'forwarded' => 'Forwarded',
        'approved' => 'Approved',
        'rejected' => 'Rejected',
        'verified' => 'Verified',
        'logged' => 'Logged',
    ])->and(enumVocabulary(AssetStatus::cases()))->toBe([
        'available' => 'Available',
        'assigned' => 'Assigned',
        'working' => 'Working',
        'under_inspection' => 'Under inspection',
        'under_maintenance' => 'Under maintenance',
        'awaiting_parts' => 'Awaiting parts',
        'ready_for_service' => 'Ready for service',
        'unavailable' => 'Unavailable',
    ])->and(enumVocabulary(ApprovalStatus::cases()))->toBe([
        'pending' => 'Pending',
        'approved' => 'Approved',
        'rejected' => 'Rejected',
    ])->and(enumVocabulary(DispatchPriority::cases()))->toBe([
        'routine' => 'Routine',
        'priority' => 'Priority',
        'emergency' => 'Emergency',
    ])->and(enumVocabulary(ServiceRequestStatus::cases()))->toBe([
        'submitted' => 'Submitted',
        'dispatching' => 'Dispatching',
    ]);
});

/**
 * @param  array<int, ApprovalStatus|AssetStatus|DispatchPriority|DispatchStatus|FuelRequestStatus|ServiceRequestStatus>  $cases
 * @return array<string, string>
 */
function enumVocabulary(array $cases): array
{
    return collect($cases)->mapWithKeys(
        static fn (ApprovalStatus|AssetStatus|DispatchPriority|DispatchStatus|FuelRequestStatus|ServiceRequestStatus $case): array => [
            $case->value => $case->label(),
        ],
    )->all();
}
