<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function r2Asset(string $code): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => $code,
        'name' => 'R2 asset',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);
}

function r2Client(): Client
{
    return Client::query()->create(['code' => 'R2-'.fake()->unique()->numerify('#####'), 'company_name' => 'R2 client', 'status' => 'active']);
}

it('excludes only the typed current rental source and keeps exact dispatch boundaries open', function (): void {
    $actor = User::factory()->create();
    $client = r2Client();
    $asset = r2Asset('R2-BOUNDARY');
    $start = CarbonImmutable::parse('2026-08-20 00:00:00');
    $end = $start->addDay();
    $reservation = RentalReservation::query()->create([
        'reference' => 'R2-RENTAL-SOURCE',
        'client_id' => $client->id,
        'created_by' => $actor->id,
        'status' => RentalReservationStatus::Requested,
        'start_date' => $start,
        'end_date' => $start,
        'total_cents' => 100,
    ]);
    RentalReservationItem::query()->create([
        'rental_reservation_id' => $reservation->id,
        'operational_asset_id' => $asset->id,
        'quantity' => 1,
        'rate_cents' => 100,
        'line_total_cents' => 100,
    ]);

    $ownAssessment = app(OperationalAssetAvailability::class)->assess(new AssetUsageRequest(
        assetId: $asset->id,
        usageType: AssetUsageType::RentalApprove,
        windowStart: $start,
        windowEnd: $end,
        source: new AssetUsageSource('rental_reservation', $reservation->id),
    ));
    expect(collect($ownAssessment->conflicts)->pluck('code')->all())->not->toContain('rental.reservation_overlap');

    $job = DispatchJob::query()->create([
        'reference' => 'R2-DISPATCH-BOUNDARY',
        'client' => 'R2 client',
        'title' => 'R2 boundary',
        'site' => 'R2 site',
        'scheduled_start' => $start->subHours(4),
        'scheduled_end' => $start,
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Scheduled,
        'created_by' => $actor->id,
    ]);
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $actor->id,
        'active_from' => $job->scheduled_start,
    ]);

    $boundaryAssessment = app(OperationalAssetAvailability::class)->assess(new AssetUsageRequest(
        assetId: $asset->id,
        usageType: AssetUsageType::RentalCreate,
        windowStart: $start,
        windowEnd: $end,
    ));

    expect(collect($boundaryAssessment->conflicts)->pluck('code')->all())->not->toContain('dispatch.assignment_overlap');
});
