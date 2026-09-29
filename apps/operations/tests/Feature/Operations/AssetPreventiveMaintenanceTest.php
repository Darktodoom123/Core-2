<?php

use App\Modules\Assignment\Queries\AssetCandidateQuery;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fleet\Services\AssetPreventiveMaintenance;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-10-01 09:00:00', 'Asia/Manila'));
});

function pmAsset(): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => 'PM-'.fake()->unique()->numerify('####'),
        'name' => 'PM asset',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);
}

function pmWorkOrder(OperationalAsset $asset, ?string $nextDueAt): MaintenanceWorkOrder
{
    return MaintenanceWorkOrder::query()->create([
        'operational_asset_id' => $asset->id,
        'status' => 'released',
        'defect' => 'Preventive maintenance service',
        'dispatch_blocking' => false,
        'released_at' => now(),
        'next_due_at' => $nextDueAt === null ? null : CarbonImmutable::parse($nextDueAt, 'Asia/Manila')->utc(),
    ]);
}

function pmCodes(OperationalAsset $asset, AssetUsageType $type, string $end = '2026-10-05 17:00:00'): array
{
    return collect(app(OperationalAssetAvailability::class)->assess(AssetUsageRequest::dispatch(
        $asset->id,
        $type,
        CarbonImmutable::parse('2026-10-05 07:00:00', 'Asia/Manila'),
        CarbonImmutable::parse($end, 'Asia/Manila'),
    ))->conflicts)->pluck('code')->all();
}

function pmJob(DispatchStatus $status = DispatchStatus::Draft): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'PM-DSP-'.fake()->unique()->numerify('####'),
        'client' => 'PM Client',
        'title' => 'PM window check',
        'site' => 'Operations Yard',
        'scheduled_start' => CarbonImmutable::parse('2026-10-05 07:00:00', 'Asia/Manila'),
        'scheduled_end' => CarbonImmutable::parse('2026-10-05 17:00:00', 'Asia/Manila'),
        'priority' => DispatchPriority::Routine,
        'status' => $status,
        'created_by' => User::factory()->create()->id,
    ]);
}

test('the latest work order that set a next due date decides when maintenance is due', function (): void {
    $asset = pmAsset();
    pmWorkOrder($asset, '2026-10-03 08:00:00');
    pmWorkOrder($asset, null);
    pmWorkOrder($asset, '2027-01-03 08:00:00');
    $service = app(AssetPreventiveMaintenance::class);

    expect($service->dueBefore($asset, CarbonImmutable::parse('2026-10-05 17:00:00', 'Asia/Manila')))->toBeNull()
        ->and($service->dueBefore($asset, CarbonImmutable::parse('2027-01-04', 'Asia/Manila'))?->equalTo(CarbonImmutable::parse('2027-01-03 08:00:00', 'Asia/Manila')))
        ->toBeTrue();
});

test('assets without a scheduled maintenance date are never flagged', function (): void {
    $asset = pmAsset();
    pmWorkOrder($asset, null);

    expect(app(AssetPreventiveMaintenance::class)->dueBefore($asset, CarbonImmutable::parse('2030-01-01')))->toBeNull()
        ->and(pmCodes($asset, AssetUsageType::DispatchActivate))->not->toContain('asset.preventive_maintenance_due');
});

test('maintenance due before the work ends blocks activation but not planning', function (): void {
    $asset = pmAsset();
    pmWorkOrder($asset, '2026-10-05 12:00:00');

    expect(pmCodes($asset, AssetUsageType::DispatchActivate))->toContain('asset.preventive_maintenance_due')
        ->and(pmCodes($asset, AssetUsageType::DispatchAssign))->not->toContain('asset.preventive_maintenance_due')
        ->and(pmCodes($asset, AssetUsageType::DispatchReassign))->not->toContain('asset.preventive_maintenance_due');
});

test('maintenance due after the work ends does not block activation', function (): void {
    $asset = pmAsset();
    pmWorkOrder($asset, '2026-10-05 17:00:00');

    expect(pmCodes($asset, AssetUsageType::DispatchActivate))->not->toContain('asset.preventive_maintenance_due');
});

test('planning shows due maintenance as an activation warning while the asset stays eligible', function (): void {
    $asset = pmAsset();
    pmWorkOrder($asset, '2026-10-05 12:00:00');
    $job = pmJob();

    $eligibility = app(DispatchResourceEligibility::class)->asset($asset, 'equipment', $job);
    $candidates = app(AssetCandidateQuery::class);
    $candidate = $candidates->assess($asset, $job, $candidates->evidence([$asset->id], $job));

    expect($eligibility['activation_constraints'])->toContain('Preventive maintenance is due Oct 5, 2026 12:00 PM; complete it before activation.')
        ->and($candidate['eligible'])->toBe($eligibility['eligible'])
        ->and($candidate['activation_constraints'])->toContain('Preventive maintenance is due Oct 5, 2026 12:00 PM; complete it before activation.')
        ->and($candidate['reasons'])->not->toContain('Preventive maintenance is due Oct 5, 2026 12:00 PM, before this work ends.');
});

test('activation readiness lists due maintenance as a blocker', function (): void {
    $asset = pmAsset();
    pmWorkOrder($asset, '2026-10-05 12:00:00');
    $job = pmJob(DispatchStatus::Scheduled);

    $eligibility = app(DispatchResourceEligibility::class)->asset($asset, 'equipment', $job, excludeCurrentJob: true);
    $candidates = app(AssetCandidateQuery::class);
    $candidate = $candidates->assess($asset, $job, $candidates->evidence([$asset->id], $job, true));

    expect($eligibility['eligible'])->toBeFalse()
        ->and($eligibility['reasons'])->toContain('Preventive maintenance is due Oct 5, 2026 12:00 PM, before this work ends.')
        ->and($candidate['eligible'])->toBeFalse()
        ->and($candidate['reasons'])->toContain('Preventive maintenance is due Oct 5, 2026 12:00 PM, before this work ends.');
});
