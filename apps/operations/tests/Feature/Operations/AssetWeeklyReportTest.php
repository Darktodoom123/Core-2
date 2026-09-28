<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    // Wednesday 2026-09-23 10:00 Manila; week = Mon 21 – Sun 27 Sep.
    Carbon::setTestNow(Carbon::parse('2026-09-23 02:00:00', 'UTC'));
});

afterEach(fn () => Carbon::setTestNow());

function assetWeeklyUser(RoleName $role, string $name): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

/** @return array{manager: User, operator: User, asset: OperationalAsset, job: DispatchJob} */
function seedAssetWeek(): array
{
    $manager = assetWeeklyUser(RoleName::OperationsManager, 'Maria Manager');
    $operator = assetWeeklyUser(RoleName::CraneOperator, 'Oscar Operator');

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-77',
        'name' => '70T Mobile Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Working,
        'baseline_burn_rate' => 12,
        'burn_rate_unit' => 'litres_per_hour',
    ]);
    $otherAsset = OperationalAsset::query()->create(['code' => 'TRK-01', 'name' => 'Truck', 'kind' => 'truck', 'status' => AssetStatus::Working]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-WK-1',
        'client' => 'Metro Rail',
        'title' => 'Girder lift',
        'site' => 'Pier 4',
        'status' => DispatchStatus::Dispatched,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => Carbon::parse('2026-09-22 00:00:00', 'UTC'),
        'scheduled_end' => Carbon::parse('2026-09-22 08:00:00', 'UTC'),
        'created_by' => $manager->id,
    ]);
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id, 'operational_asset_id' => $asset->id,
        'assignment_type' => 'primary_crane', 'assigned_by' => $manager->id,
        'active_from' => Carbon::parse('2026-09-22 00:00:00', 'UTC'),
    ]);
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id, 'user_id' => $operator->id,
        'assignment_type' => 'operator', 'assigned_by' => $manager->id,
        'active_from' => Carbon::parse('2026-09-22 00:00:00', 'UTC'),
    ]);

    // 6h shift on this crane, plus a 2h shift on another asset the same week.
    OperatorShift::query()->create([
        'user_id' => $operator->id, 'operational_asset_id' => $asset->id, 'dispatch_job_id' => $job->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => Carbon::parse('2026-09-22 00:00:00', 'UTC'),
        'ended_at' => Carbon::parse('2026-09-22 06:00:00', 'UTC'),
        'operating_minutes' => 300,
    ]);
    OperatorShift::query()->create([
        'user_id' => $operator->id, 'operational_asset_id' => $otherAsset->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => Carbon::parse('2026-09-24 00:00:00', 'UTC'),
        'ended_at' => Carbon::parse('2026-09-24 02:00:00', 'UTC'),
    ]);

    $request = FuelRequest::query()->create([
        'reference' => 'FUEL-WK-1', 'requester_id' => $operator->id,
        'operational_asset_id' => $asset->id, 'dispatch_job_id' => $job->id,
        'quantity_litres' => 80, 'fuel_type' => 'diesel', 'purpose' => 'Lift day',
        'status' => FuelRequestStatus::Logged,
    ]);
    FuelLog::query()->create([
        'fuel_request_id' => $request->id, 'recorded_by' => $manager->id,
        'quantity_litres' => 75.5, 'price_per_litre' => 62.40, 'total_cost' => 4711.20,
        'fuel_station' => 'Petron EDSA', 'effective_burn_rate' => 12.6, 'is_anomaly' => false,
        'recorded_at' => Carbon::parse('2026-09-22 01:00:00', 'UTC'),
    ]);
    // Last week's log must not leak into this week.
    FuelLog::query()->create([
        'fuel_request_id' => $request->id, 'recorded_by' => $manager->id,
        'quantity_litres' => 999, 'total_cost' => 1, 'recorded_at' => Carbon::parse('2026-09-15 01:00:00', 'UTC'),
    ]);

    JobReport::query()->create([
        'dispatch_job_id' => $job->id, 'author_id' => $operator->id,
        'work_summary' => 'Set two girders on pier 4', 'status' => 'submitted',
        'started_at' => Carbon::parse('2026-09-22 00:30:00', 'UTC'),
        'ended_at' => Carbon::parse('2026-09-22 05:00:00', 'UTC'),
        'submitted_at' => Carbon::parse('2026-09-22 06:00:00', 'UTC'),
    ]);

    return compact('manager', 'operator', 'asset', 'job');
}

it('builds the asset week from recorded fuel, shifts, personnel and job reports only', function (): void {
    ['manager' => $manager, 'asset' => $asset] = seedAssetWeek();

    $response = $this->actingAs($manager)
        ->getJson('/operations/reports/asset-weekly?asset_id='.$asset->id.'&week=2026-09-25')
        ->assertOk();

    $report = $response->json('report');

    expect($response->json('assets.*.code'))->toContain('CRN-77')
        ->and($report['week']['start'])->toBe('2026-09-21')
        ->and($report['week']['end'])->toBe('2026-09-27')
        ->and($report['currency'])->toBe('PHP')
        ->and($report['summary']['jobs'])->toBe(1)
        ->and($report['summary']['fuel_logs'])->toBe(1)
        ->and($report['summary']['fuel_litres'])->toEqual(75.5)
        ->and($report['summary']['fuel_cost'])->toEqual(4711.2)
        ->and($report['summary']['on_duty_minutes'])->toBe(360)
        ->and($report['summary']['reported_work_minutes'])->toBe(270)
        ->and($report['personnel'])->toHaveCount(1)
        ->and($report['personnel'][0]['name'])->toBe('Oscar Operator')
        ->and($report['personnel'][0]['minutes_on_asset'])->toBe(360)
        ->and($report['personnel'][0]['week_on_duty_minutes'])->toBe(480)
        ->and($report['personnel'][0]['week_shifts'])->toBe(2)
        ->and($report['days'][1]['operators'])->toBe(['Oscar Operator'])
        ->and($report['days'][1]['jobs'])->toBe(['DSP-WK-1'])
        ->and($report['job_reports'][0]['duration_minutes'])->toBe(270);
});

it('reports missing data as null instead of inventing values', function (): void {
    $manager = assetWeeklyUser(RoleName::OperationsManager, 'Maria Manager');
    $asset = OperationalAsset::query()->create(['code' => 'IDLE-1', 'name' => 'Idle crane', 'kind' => 'crane', 'status' => AssetStatus::Working]);

    $report = $this->actingAs($manager)
        ->getJson('/operations/reports/asset-weekly?asset_id='.$asset->id)
        ->assertOk()
        ->json('report');

    expect($report['summary']['fuel_cost'])->toBeNull()
        ->and($report['summary']['average_burn_rate'])->toBeNull()
        ->and($report['summary']['jobs'])->toBe(0)
        ->and($report['personnel'])->toBe([]);
});

it('downloads a real CSV with peso-labelled numeric money columns', function (): void {
    ['manager' => $manager, 'asset' => $asset] = seedAssetWeek();

    $response = $this->actingAs($manager)
        ->get('/operations/reports/asset-weekly/'.$asset->id.'/download?format=csv&week=2026-09-21')
        ->assertOk()
        ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
        ->assertDownload('asset-crn-77-week-2026-09-21.csv');

    $csv = $response->getContent();

    expect($csv)->toStartWith("\xEF\xBB\xBF")
        ->toContain('Total Cost (PHP)')
        ->toContain('4711.2')
        ->toContain('Oscar Operator')
        ->toContain('Personnel')
        ->not->toContain('$')
        ->not->toContain('999');
    expect(AuditEvent::query()->where('action', 'report.asset_weekly.downloaded')->exists())->toBeTrue();
});

it('downloads a real PDF document', function (): void {
    ['manager' => $manager, 'asset' => $asset] = seedAssetWeek();

    $response = $this->actingAs($manager)
        ->get('/operations/reports/asset-weekly/'.$asset->id.'/download?format=pdf&week=2026-09-21')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf');

    expect(substr($response->getContent(), 0, 5))->toBe('%PDF-')
        ->and(strlen($response->getContent()))->toBeGreaterThan(2000);
});

it('blocks asset reports for users without fleet or reporting access', function (): void {
    ['operator' => $operator, 'asset' => $asset] = seedAssetWeek();

    $this->actingAs($operator)
        ->getJson('/operations/reports/asset-weekly?asset_id='.$asset->id)
        ->assertForbidden();
    $this->actingAs($operator)
        ->get('/operations/reports/asset-weekly/'.$asset->id.'/download?format=pdf')
        ->assertForbidden();
});

it('downloads job report PDFs only for reports the viewer may see', function (): void {
    ['manager' => $manager, 'job' => $job] = seedAssetWeek();
    $report = JobReport::query()->where('dispatch_job_id', $job->id)->firstOrFail();
    $stranger = assetWeeklyUser(RoleName::CraneOperator, 'Stranger');

    $single = $this->actingAs($manager)->get('/operations/job-reports/'.$report->id.'/pdf')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf');
    expect(substr($single->getContent(), 0, 5))->toBe('%PDF-');

    $packet = $this->actingAs($manager)->get('/operations/job-reports/packet.pdf?ids[]='.$report->id)
        ->assertOk();
    expect(substr($packet->getContent(), 0, 5))->toBe('%PDF-');

    $this->actingAs($stranger)->get('/operations/job-reports/'.$report->id.'/pdf')->assertForbidden();
    $this->actingAs($stranger)->get('/operations/job-reports/packet.pdf?ids[]='.$report->id)->assertNotFound();
});
