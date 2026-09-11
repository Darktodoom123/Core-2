<?php

use Illuminate\Support\Facades\Process;
use Tests\TestCase;

uses(TestCase::class);

/** @return list<string> */
function nxProjectNames(string $output): array
{
    $decoded = json_decode(trim($output), true);

    if (is_array($decoded)) {
        return array_values(array_filter($decoded, 'is_string'));
    }

    return array_values(array_filter(array_map('trim', preg_split('/\R/', trim($output)) ?: [])));
}

test('nx discovers logical projects operations and field-mobile', function (): void {
    $workspaceRoot = dirname(base_path(), 2);
    $result = Process::path($workspaceRoot)->timeout(90)->run('npx nx show projects');

    expect($result->successful())->toBeTrue();

    $output = nxProjectNames($result->output());

    expect($output)->toContain('operations')
        ->and($output)->toContain('field-mobile')
        ->and($output)->toContain('tracking');
});

test('nx affected selection isolates mobile changes from operations but cascades root changes', function (): void {
    $workspaceRoot = dirname(base_path(), 2);
    $mobileRun = Process::path($workspaceRoot)->timeout(90)->run('npx nx show projects --affected --files=packages/field-mobile/src/index.ts');

    expect($mobileRun->successful())->toBeTrue();
    $mobileAffected = nxProjectNames($mobileRun->output());

    expect($mobileAffected)->toContain('field-mobile')
        ->and($mobileAffected)->not->toContain('operations');

    $phpRun = Process::path($workspaceRoot)->timeout(90)->run('npx nx show projects --affected --files=apps/operations/app/Platform/Safety/Events/SosIncidentChanged.php');

    expect($phpRun->successful())->toBeTrue();
    $phpAffected = nxProjectNames($phpRun->output());

    expect($phpAffected)->toContain('operations')
        ->and($phpAffected)->toContain('field-mobile');
});

test('nx propagates failure exit code when a target command fails', function (): void {
    $workspaceRoot = dirname(base_path(), 2);
    $failedRun = Process::path($workspaceRoot)->timeout(90)->run('npx nx run operations:nonexistent-target');

    expect($failedRun->failed())->toBeTrue()
        ->and($failedRun->exitCode())->toBeGreaterThan(0);
});
