<?php

use App\Modules\Dvir\Models\DvirInspection;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Services\AssetInspectionReadiness;

test('workshop clearance is required for activation and a clean DVIR cannot replace it', function (): void {
    $readiness = new AssetInspectionReadiness;
    $passing = new Inspection(['result' => 'passed', 'completed_at' => '2026-09-25 08:00:00']);
    $failed = new Inspection(['result' => 'failed', 'completed_at' => '2026-09-26 08:00:00']);
    $cleanDvir = new DvirInspection([
        'has_defects' => false,
        'critical_defects_count' => 0,
        'completed_at' => '2026-09-27 08:00:00',
    ]);
    $defectiveDvir = new DvirInspection([
        'has_defects' => true,
        'critical_defects_count' => 1,
        'completed_at' => '2026-09-27 08:00:00',
    ]);

    expect($readiness->lacksPassingClearance(collect(), null))->toBeTrue()
        ->and($readiness->lacksPassingClearance(collect(), $cleanDvir))->toBeTrue()
        ->and($readiness->lacksPassingClearance(collect([$passing]), null))->toBeFalse()
        ->and($readiness->lacksPassingClearance(collect([$passing, $failed]), null))->toBeTrue()
        ->and($readiness->lacksPassingClearance(collect([$passing, $failed]), $cleanDvir))->toBeTrue()
        ->and($readiness->lacksPassingClearance(collect([$passing]), $defectiveDvir))->toBeTrue()
        ->and($readiness->hasUnsafeEvidence(collect(), null))->toBeFalse()
        ->and($readiness->hasUnsafeEvidence(collect([$failed]), null))->toBeTrue()
        ->and($readiness->hasUnsafeEvidence(collect([$passing]), $defectiveDvir))->toBeTrue();
});
