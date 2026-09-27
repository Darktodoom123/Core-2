<?php

use App\Platform\Gpt\Services\DispatchAdviceQualityGate;

test('rejects an AI clock outside the verified local job window', function (): void {
    $context = ['job' => [
        'schedule_timezone' => 'Asia/Manila',
        'scheduled_start' => '2026-09-30T16:00:00+08:00',
        'scheduled_end' => '2026-09-30T20:00:00+08:00',
    ]];
    $gate = app(DispatchAdviceQualityGate::class);

    expect($gate->hasSupportedClockTimes(['summary' => 'Work from 08:00 to 12:00'], $context))->toBeFalse()
        ->and($gate->hasSupportedClockTimes(['summary' => 'Work from 16:00 to 20:00'], $context))->toBeTrue()
        ->and($gate->hasSupportedClockTimes(['proposed_schedule' => [['21:00', 'Complete lift']]], $context))->toBeFalse();
});

test('checks overnight job times on both calendar days', function (): void {
    $context = ['job' => [
        'schedule_timezone' => 'Asia/Manila',
        'scheduled_start' => '2026-09-30T22:00:00+08:00',
        'scheduled_end' => '2026-10-01T02:00:00+08:00',
    ]];

    expect(app(DispatchAdviceQualityGate::class)->hasSupportedClockTimes([
        'proposed_schedule' => [['23:00', 'Start'], ['01:00', 'Finish']],
    ], $context))->toBeTrue();
});
