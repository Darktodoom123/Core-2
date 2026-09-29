<?php

use App\Modules\Assignment\Http\Requests\ListDispatchCandidatesRequest;
use App\Modules\Assignment\Queries\AssetCandidateQuery;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fleet\Models\AssetDocument;
use App\Modules\Fleet\Services\AssetPermitCompliance;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->travelTo(CarbonImmutable::parse('2026-10-01 09:00:00', 'Asia/Manila'));
    config(['fleet.block_missing_permits' => false]);
});

function permitAsset(string $kind = 'mobile_crane'): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => 'PERMIT-'.fake()->unique()->numerify('####'),
        'name' => 'Permit asset',
        'kind' => $kind,
        'status' => AssetStatus::Available,
    ]);
}

function permitDocument(OperationalAsset $asset, string $category, ?string $expiresAt, string $status = 'active'): AssetDocument
{
    return AssetDocument::query()->create([
        'operational_asset_id' => $asset->id,
        'category' => $category,
        'document_type' => $category,
        'title' => $category,
        'document_number' => 'DOC-'.fake()->unique()->numerify('#####'),
        'issuing_authority' => 'Authority',
        'expires_at' => $expiresAt,
        'status' => $status,
    ]);
}

function permitConflicts(OperationalAsset $asset, string $end, AssetUsageType $type = AssetUsageType::DispatchAssign): array
{
    return app(OperationalAssetAvailability::class)->assess(AssetUsageRequest::dispatch(
        $asset->id,
        $type,
        CarbonImmutable::parse('2026-10-05 07:00:00', 'Asia/Manila'),
        CarbonImmutable::parse($end, 'Asia/Manila'),
    ))->conflicts;
}

test('required permits follow the asset kind', function (): void {
    $compliance = app(AssetPermitCompliance::class);

    expect($compliance->requiredCategories(permitAsset('mobile_crane')))
        ->toEqualCanonicalizing(['registrations', 'insurance', 'emission_certs', 'load_test_certs'])
        ->and($compliance->requiredCategories(permitAsset('tower_crane')))
        ->toEqualCanonicalizing(['insurance', 'load_test_certs'])
        ->and($compliance->requiredCategories(permitAsset('unknown_kind')))->toBe([]);
});

test('each required permit reports valid, expired, revoked, or missing', function (): void {
    $asset = permitAsset();
    permitDocument($asset, 'registrations', '2027-01-01');
    permitDocument($asset, 'insurance', '2026-09-30');
    permitDocument($asset, 'emission_certs', '2027-01-01', 'revoked');

    $states = collect(app(AssetPermitCompliance::class)->assess($asset, CarbonImmutable::parse('2026-10-05', 'Asia/Manila')))
        ->pluck('state', 'category')->all();

    expect($states)->toBe([
        'registrations' => 'valid',
        'insurance' => 'expired',
        'emission_certs' => 'revoked',
        'load_test_certs' => 'missing',
    ]);
});

test('a renewed permit replaces the expired one it supersedes', function (): void {
    $asset = permitAsset('tower_crane');
    permitDocument($asset, 'insurance', '2026-09-01');
    permitDocument($asset, 'insurance', '2027-09-01');
    permitDocument($asset, 'load_test_certs', '2027-09-01');

    expect(permitConflicts($asset, '2026-10-05 17:00:00'))->toBe([]);
});

test('a permit that expires before the job ends blocks assignment and activation', function (AssetUsageType $type): void {
    $asset = permitAsset('tower_crane');
    permitDocument($asset, 'insurance', '2027-01-01');
    permitDocument($asset, 'load_test_certs', '2026-10-04');

    $conflicts = permitConflicts($asset, '2026-10-05 17:00:00', $type);

    expect(collect($conflicts)->pluck('code')->all())->toContain('asset.permit_invalid')
        ->and(collect($conflicts)->firstWhere('code', 'asset.permit_invalid')->message)
        ->toContain('Load Test Certificate');
})->with([
    'assign' => AssetUsageType::DispatchAssign,
    'reassign' => AssetUsageType::DispatchReassign,
    'activate' => AssetUsageType::DispatchActivate,
]);

test('a permit valid through the last day of the job does not block it', function (): void {
    $asset = permitAsset('tower_crane');
    permitDocument($asset, 'insurance', '2026-10-05');
    permitDocument($asset, 'load_test_certs', '2026-10-05');

    expect(collect(permitConflicts($asset, '2026-10-05 17:00:00'))->pluck('code')->all())
        ->not->toContain('asset.permit_invalid');
});

test('missing permits only block dispatch once enforcement is switched on', function (): void {
    $asset = permitAsset('tower_crane');

    expect(collect(permitConflicts($asset, '2026-10-05 17:00:00'))->pluck('code')->all())
        ->not->toContain('asset.permit_invalid');

    config(['fleet.block_missing_permits' => true]);

    expect(collect(permitConflicts($asset, '2026-10-05 17:00:00'))->pluck('code')->all())
        ->toContain('asset.permit_invalid');
});

test('permits do not affect non-dispatch asset usage', function (): void {
    $asset = permitAsset('tower_crane');
    permitDocument($asset, 'load_test_certs', '2026-01-01');

    $conflicts = app(OperationalAssetAvailability::class)->assess(new AssetUsageRequest(
        assetId: $asset->id,
        usageType: AssetUsageType::RentalApprove,
        windowStart: CarbonImmutable::parse('2026-10-05'),
        windowEnd: CarbonImmutable::parse('2026-10-06'),
    ))->conflicts;

    expect(collect($conflicts)->pluck('code')->all())->not->toContain('asset.permit_invalid');
});

test('the assignment picker marks equipment with an expired permit as ineligible', function (): void {
    $creator = User::factory()->create();
    $job = DispatchJob::query()->create([
        'reference' => 'PERMIT-PICKER', 'client' => 'Client', 'title' => 'Lift', 'site' => 'Yard',
        'scheduled_start' => CarbonImmutable::parse('2026-10-05 07:00:00', 'Asia/Manila'),
        'scheduled_end' => CarbonImmutable::parse('2026-10-05 17:00:00', 'Asia/Manila'),
        'priority' => DispatchPriority::Routine, 'status' => DispatchStatus::Scheduled,
        'created_by' => $creator->id, 'version' => 1,
    ]);
    $asset = permitAsset('equipment');
    clearDispatchAsset($asset);
    permitDocument($asset, 'insurance', '2026-10-04');

    $candidate = collect(app(AssetCandidateQuery::class)->page($job, ListDispatchCandidatesRequest::create('/', 'GET', [
        'resource' => 'assets', 'per_page' => 25,
    ]))->data)->firstWhere('id', $asset->id);

    expect($candidate['eligible'])->toBeFalse()
        ->and($candidate['reasons'])->toContain('Comprehensive / Third-Party Insurance expires 2026-10-04, before this work ends.');
});

test('renewing a permit supersedes the earlier record only for the same asset and category', function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake(config('attachments.disk'));
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $asset = permitAsset('tower_crane');
    $other = permitAsset('tower_crane');
    $expired = permitDocument($asset, 'load_test_certs', '2026-09-01');
    $foreign = permitDocument($other, 'load_test_certs', '2026-09-01');
    $renewal = fn (int $supersedes): array => [
        'category' => 'load_test_certs',
        'title' => 'Load test',
        'expires_at' => '2027-09-01',
        'file' => UploadedFile::fake()->create('load-test.pdf', 20, 'application/pdf'),
        'supersedes_document_id' => $supersedes,
    ];

    $this->actingAs($manager)->post("/operations/assets/{$asset->id}/documents", $renewal($foreign->id))
        ->assertSessionHasErrors('supersedes_document_id');
    expect($foreign->fresh()->status)->toBe('active');

    $this->actingAs($manager)->post("/operations/assets/{$asset->id}/documents", $renewal($expired->id))
        ->assertSessionHasNoErrors();

    expect($expired->fresh()->status)->toBe('superseded')
        ->and(collect(app(AssetPermitCompliance::class)->assess($asset))->firstWhere('category', 'load_test_certs')['state'])
        ->toBe('valid');
});

test('the Fleet view model summarises permits and blocks dispatch when one has expired', function (): void {
    $asset = permitAsset('tower_crane');
    permitDocument($asset, 'insurance', '2026-10-20');
    permitDocument($asset, 'load_test_certs', '2026-09-30');

    $view = OperationsWorkspaceViewModel::assets(OperationalAsset::query()->whereKey($asset->id)->with('documents')->get())[0];

    expect($view['permit_compliance']['state'])->toBe('expired')
        ->and($view['permit_compliance']['blocks_dispatch'])->toBeTrue()
        ->and(collect($view['permit_compliance']['items'])->pluck('days_left', 'category')->all())
        ->toBe(['insurance' => 19, 'load_test_certs' => -1])
        ->and($view['is_dispatchable'])->toBeFalse()
        ->and(collect($view['dispatchability']['blockers'])->pluck('code')->all())->toContain('permit');
});
