<?php

use Illuminate\Support\Facades\Process;
use Tests\TestCase;

uses(TestCase::class);

test('nx discovers logical projects operations and field-mobile', function (): void {
    $result = Process::timeout(90)->run('npx nx show projects');

    expect($result->successful())->toBeTrue();

    $output = array_filter(array_map('trim', explode("\n", $result->output())));

    expect($output)->toContain('operations')
        ->and($output)->toContain('field-mobile');
});

test('nx affected selection isolates mobile changes from operations but cascades root changes', function (): void {
    $mobileRun = Process::timeout(90)->run('npx nx show projects --affected --files=packages/field-mobile/src/index.ts');

    expect($mobileRun->successful())->toBeTrue();
    $mobileAffected = array_filter(array_map('trim', explode("\n", $mobileRun->output())));

    expect($mobileAffected)->toContain('field-mobile')
        ->and($mobileAffected)->not->toContain('operations');

    $phpRun = Process::timeout(90)->run('npx nx show projects --affected --files=app/Platform/Safety/Events/SosIncidentChanged.php');

    expect($phpRun->successful())->toBeTrue();
    $phpAffected = array_filter(array_map('trim', explode("\n", $phpRun->output())));

    expect($phpAffected)->toContain('operations')
        ->and($phpAffected)->toContain('field-mobile');
});

test('nx propagates failure exit code when a target command fails', function (): void {
    $failedRun = Process::timeout(90)->run('npx nx run operations:nonexistent-target');

    expect($failedRun->failed())->toBeTrue()
        ->and($failedRun->exitCode())->toBeGreaterThan(0);
});
