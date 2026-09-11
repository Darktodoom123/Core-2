<?php

namespace App\Modules\Dispatch\ViewModels;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;

final class DispatchFieldProgressionViewModel
{
    /** @var list<DispatchStatus> */
    private const STEPS = [
        DispatchStatus::Dispatched,
        DispatchStatus::Accepted,
        DispatchStatus::EnRoute,
        DispatchStatus::Arrived,
        DispatchStatus::Working,
        DispatchStatus::Completed,
    ];

    /** @return array<string, mixed> */
    public static function make(DispatchJob $job): array
    {
        $next = $job->status->nextFieldStatus();
        $workflow = self::machineryWorkflow($job);

        return [
            'current' => self::status($job->status),
            'machinery_workflow' => $workflow,
            'steps' => array_map(
                static fn (DispatchStatus $status): array => [
                    'status' => self::status($status),
                    'state' => self::stepState($job->status, $status),
                ],
                self::STEPS,
            ),
            'next' => $next === null ? null : [
                'status' => self::status($next),
                'action_label' => $job->status->fieldActionLabel(),
                'confirmation_title' => self::confirmationTitle($job->status, $workflow),
                'confirmation_message' => self::confirmationMessage($job, $job->status, $workflow),
            ],
            'message' => self::message($job->status),
        ];
    }

    public static function machineryWorkflow(DispatchJob $job): string
    {
        $hasTowerCrane = $job->assetAssignments
            ->contains(static fn ($assignment): bool => $assignment->asset->isStationary());

        return $hasTowerCrane ? 'tower_crane_site' : 'mobile_transit';
    }

    /** @return array{value: string, label: string} */
    private static function status(DispatchStatus $status): array
    {
        return [
            'value' => $status->value,
            'label' => $status->label(),
        ];
    }

    private static function stepState(DispatchStatus $current, DispatchStatus $step): string
    {
        $currentIndex = array_search($current, self::STEPS, true);
        $stepIndex = array_search($step, self::STEPS, true);

        if ($currentIndex === false || $stepIndex === false) {
            return 'upcoming';
        }

        if ($stepIndex < $currentIndex) {
            return 'complete';
        }

        return $stepIndex === $currentIndex ? 'current' : 'upcoming';
    }

    private static function confirmationTitle(DispatchStatus $current, string $workflow = 'mobile_transit'): string
    {
        if ($workflow === 'tower_crane_site') {
            return match ($current) {
                DispatchStatus::Dispatched => 'Accept this tower crane shift?',
                DispatchStatus::Accepted => 'Arrive at site & access crane?',
                DispatchStatus::EnRoute => 'At crane base?',
                DispatchStatus::Arrived => 'Start hoisting operations?',
                DispatchStatus::Working => 'Complete shift & free-slew crane?',
                default => 'Confirm status change?',
            };
        }

        return match ($current) {
            DispatchStatus::Dispatched => 'Accept this job?',
            DispatchStatus::Accepted => 'Start the route?',
            DispatchStatus::EnRoute => 'Confirm arrival?',
            DispatchStatus::Arrived => 'Start work on site?',
            DispatchStatus::Working => 'Complete this job?',
            default => 'Confirm status change?',
        };
    }

    private static function confirmationMessage(DispatchJob $job, DispatchStatus $current, string $workflow = 'mobile_transit'): string
    {
        if ($workflow === 'tower_crane_site') {
            return match ($current) {
                DispatchStatus::Dispatched => "You are accepting tower crane assignment {$job->reference}. Live masthead wind monitoring will be initialized.",
                DispatchStatus::Accepted => "This marks {$job->reference} as on-site. Perform pre-climb inspection before ascending mast.",
                DispatchStatus::EnRoute => "This marks {$job->reference} at crane foundation. Ensure climb safety harness is inspected.",
                DispatchStatus::Arrived => "This marks {$job->reference} as working. Masthead wind anemometer will continuously monitor DOLE safety thresholds.",
                DispatchStatus::Working => "This closes the shift for {$job->reference}. Ensure brake is released to free-slew (weather-vane) mode.",
                default => "This updates {$job->reference} to the next field status.",
            };
        }

        return match ($current) {
            DispatchStatus::Dispatched => "You are accepting responsibility for {$job->reference}. The operations team will see the job as accepted.",
            DispatchStatus::Accepted => "This marks {$job->reference} as en route. Heavy route corridor guidance and GPS streaming will activate.",
            DispatchStatus::EnRoute => "This marks {$job->reference} as arrived. Confirm only when carrier is positioned at the job site.",
            DispatchStatus::Arrived => "This marks {$job->reference} as working. Ensure outrigger pads and level bubble are verified.",
            DispatchStatus::Working => "This closes field progression for {$job->reference}. Confirm only when the assigned work is complete.",
            default => "This updates {$job->reference} to the next field status.",
        };
    }

    private static function message(DispatchStatus $status): string
    {
        return match ($status) {
            DispatchStatus::Completed => 'Field work is complete. No further status action is available.',
            DispatchStatus::Cancelled => 'This dispatch was cancelled. No field status action is available.',
            DispatchStatus::Draft,
            DispatchStatus::PendingApproval,
            DispatchStatus::Scheduled => 'The dispatch is not ready for field progression yet.',
            default => 'Advance only when the next field milestone is true.',
        };
    }
}
