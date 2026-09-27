<?php

namespace App\Platform\Gpt\Services;

final class BlockerAdviceFormatter
{
    /**
     * @param  array<string, mixed>  $context
     * @param  list<array{id: int, focus: string}>  $rankedOptions
     * @return array<string, mixed>
     */
    public function build(array $context, array $rankedOptions): array
    {
        $approved = array_column($context['options'] ?? [], null, 'id');
        $options = [];
        foreach ($rankedOptions as $ranked) {
            $option = $approved[$ranked['id']];
            $focus = $ranked['focus'];
            $explanation = match ($focus) {
                'availability' => $option['evidence']['availability'] === 'not_recorded'
                    ? 'Availability is not recorded. Confirm it before assigning.'
                    : 'Recorded availability is '.str_replace('_', ' ', (string) $option['evidence']['availability']).'.',
                'credential' => $option['evidence']['credential'] === 'valid'
                    ? 'The required credential is valid at the scheduled start.'
                    : 'No role-specific credential is required for this assignment.',
                'readiness' => 'Recorded asset readiness is '.str_replace('_', ' ', (string) $option['evidence']['readiness']).'.',
                'schedule_conflicts' => 'No overlapping commitment was found for the scheduled window.',
                default => throw new \UnexpectedValueException('Unsupported blocker evidence key.'),
            };
            $options[] = [...$option, 'explanation' => $explanation];
        }

        return [
            'version' => 1,
            'job_version' => $context['job']['version'],
            'blocker' => $context['blocker'],
            'summary' => $options === []
                ? 'No eligible replacement was found. Review resources in the assignment workspace.'
                : 'Review these eligible resources for the identified blocker. Other readiness checks still apply.',
            'options' => $options,
        ];
    }
}
