<?php

use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use App\Shared\Assets\Data\AssetUsageConflict;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

it('keeps usage requests and sources typed and immutable', function (): void {
    $source = new AssetUsageSource('rental_reservation', 42);
    $request = new AssetUsageRequest(
        assetId: 7,
        usageType: AssetUsageType::RentalApprove,
        windowStart: CarbonImmutable::parse('2026-08-13 00:00:00'),
        windowEnd: CarbonImmutable::parse('2026-08-14 00:00:00'),
        source: $source,
    );

    expect($request->assetId)->toBe(7)
        ->and($request->usageType)->toBe(AssetUsageType::RentalApprove)
        ->and($request->windowStart)->toEqual(CarbonImmutable::parse('2026-08-13 00:00:00'))
        ->and($request->source)->toEqual($source);
});

it('returns stable checker conflicts and lets callers choose the validation key', function (): void {
    $asset = OperationalAsset::query()->create([
        'code' => 'ASSET-CONTRACT-TEST',
        'name' => 'Contract test asset',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);

    $checker = new class implements AssetUsageConflictChecker
    {
        public function conflicts(AssetUsageRequest $request): iterable
        {
            yield new AssetUsageConflict('rental.reservation_overlap', 'The asset is reserved for another rental.');
        }
    };

    $availability = new OperationalAssetAvailability([$checker]);
    $request = new AssetUsageRequest(1, AssetUsageType::SalesTransfer);

    expect($availability->assess($request)->conflicts)->toHaveCount(1)
        ->and($availability->assess($request)->conflicts[0]->code)->toBe('rental.reservation_overlap');

    expect(fn (): mixed => $availability->assertNoConflict($request, 'items'))
        ->toThrow(ValidationException::class);
});
