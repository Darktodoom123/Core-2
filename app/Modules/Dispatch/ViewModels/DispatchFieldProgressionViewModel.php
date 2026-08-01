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

        return [
            'current' => self::status($job->status),
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
                'confirmation_title' => self::confirmationTitle($job->status),
                'confirmation_message' => self::confirmationMessage($job, $job->status),
            ],
            'message' => self::message($job->status),
        ];
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

    private static function confirmationTitle(DispatchStatus $current): string
    {
        return match ($current) {
            DispatchStatus::Dispatched => 'Accept this job?',
            DispatchStatus::Accepted => 'Start the route?',
            DispatchStatus::EnRoute => 'Confirm arrival?',
            DispatchStatus::Arrived => 'Start work on site?',
            DispatchStatus::Working => 'Complete this job?',
            default => 'Confirm status change?',
        };
    }

    private static function confirmationMessage(DispatchJob $job, DispatchStatus $current): string
    {
        return match ($current) {
            DispatchStatus::Dispatched => "You are accepting responsibility for {$job->reference}. The dispatcher will see the job as accepted.",
            DispatchStatus::Accepted => "This marks {$job->reference} as en route. Confirm only when travel to the site has started.",
            DispatchStatus::EnRoute => "This marks {$job->reference} as arrived. Confirm only when you are at the job site.",
            DispatchStatus::Arrived => "This marks {$job->reference} as working. Confirm when field work has started.",
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
