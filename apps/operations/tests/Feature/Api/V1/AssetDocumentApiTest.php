<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fleet\Models\AssetDocument;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

function createAssetWithPermit(string $code = 'CRN-50'): array
{
    $asset = OperationalAsset::query()->create([
        'code' => $code,
        'name' => '50T All Terrain Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $permit = AssetDocument::query()->create([
        'operational_asset_id' => $asset->id,
        'category' => 'road_permits',
        'document_type' => 'road_permits',
        'title' => 'DPWH Special Road Transit Permit',
        'document_number' => 'DPWH-NCR-2026-SP-8821',
        'issuing_authority' => 'Department of Public Works and Highways',
        'issued_at' => now()->subMonths(2),
        'expires_at' => now()->addMonths(4),
        'status' => 'active',
        'notes' => 'Authorized for off-peak transit along C-5 and EDSA.',
    ]);

    $fileContent = '%PDF-1.4 DPWH official transit permit';
    $path = "attachments/assets/{$asset->id}/permit_8821.pdf";
    Storage::disk('private')->put($path, $fileContent);

    $attachment = Attachment::query()->create([
        'disk' => 'private',
        'path' => $path,
        'original_filename' => 'permit_8821.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => strlen($fileContent),
        'checksum_sha256' => hash('sha256', $fileContent),
        'uploaded_by' => 1,
        'kind' => 'asset_document',
        'owner_type' => $permit->getMorphClass(),
        'owner_id' => $permit->id,
    ]);

    return [$asset, $permit, $attachment, $fileContent];
}

function assignOperatorToAsset(User $operator, OperationalAsset $asset): DispatchJob
{
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-'.Str::random(6),
        'client' => 'Metro Manila Rail Transit',
        'title' => 'Structural Lift Ops',
        'site' => 'Ortigas Flyover Site',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    DB::table('dispatch_asset_assignments')->insert([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'crane',
        'assigned_by' => $dispatcher->id,
        'active_until' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('dispatch_personnel_assignments')->insert([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'operator',
        'assigned_by' => $dispatcher->id,
        'active_until' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return $job;
}

it('allows assigned operator to list compliance documents for their assigned asset', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    [$asset, $permit] = createAssetWithPermit('CRN-50');
    assignOperatorToAsset($operator, $asset);

    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->getJson(route('api.v1.fleet.assets.permits.index', $asset->code));

    $response->assertOk();
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.id', (string) $permit->id);
    $response->assertJsonPath('data.0.category', 'road_permits');
    $response->assertJsonPath('data.0.categoryLabel', 'Road Transit Permit');
    $response->assertJsonPath('data.0.documentType', 'road_permits');
    $response->assertJsonPath('data.0.title', 'DPWH Special Road Transit Permit');
    $response->assertJsonPath('data.0.documentNumber', 'DPWH-NCR-2026-SP-8821');
    $response->assertJsonPath('data.0.issuingAuthority', 'Department of Public Works and Highways');
    $response->assertJsonPath('data.0.status', 'valid');
    $response->assertJsonPath('data.0.validityStatus', 'valid');
    $response->assertJsonPath('data.0.recordStatus', 'active');
    $response->assertJsonPath('data.0.isExpired', false);
    $response->assertJsonPath('data.0.notes', 'Authorized for off-peak transit along C-5 and EDSA.');
    expect($response->json('data.0.fileUri'))->not->toBeNull();
    $response->assertJsonPath('data.0.fileType', 'application/pdf');
    $response->assertJsonPath('data.0.fileName', 'permit_8821.pdf');
});

it('exposes every supported asset category with a shared label and validity status', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-CATEGORIES',
        'name' => 'Category Contract Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    foreach ([
        ['category' => 'insurance', 'label' => 'Comprehensive / Third-Party Insurance'],
        ['category' => 'registrations', 'label' => 'Registration / LTO'],
        ['category' => 'emission_certs', 'label' => 'Smoke Emission Clearance'],
        ['category' => 'other', 'label' => 'Other Regulatory Permit'],
    ] as $index => $definition) {
        AssetDocument::query()->create([
            'operational_asset_id' => $asset->id,
            'category' => $definition['category'],
            'document_type' => $definition['category'],
            'title' => $definition['label'],
            'document_number' => 'CAT-'.$index,
            'issuing_authority' => 'Operations Authority',
            'expires_at' => null,
            'status' => 'active',
        ]);
    }

    $token = $manager->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->getJson(route('api.v1.fleet.assets.permits.index', $asset->code));

    $response->assertOk();
    $response->assertJsonCount(4, 'data');
    expect(collect($response->json('data'))->pluck('categoryLabel')->all())
        ->toEqualCanonicalizing([
            'Comprehensive / Third-Party Insurance',
            'Registration / LTO',
            'Smoke Emission Clearance',
            'Other Regulatory Permit',
        ]);
    expect(collect($response->json('data'))->pluck('validityStatus')->unique()->all())
        ->toBe(['no_expiration']);
});

it('prohibits unassigned operator from listing asset documents with 404', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    [$asset] = createAssetWithPermit('CRN-UNASSIGNED');

    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->getJson(route('api.v1.fleet.assets.permits.index', $asset->code));

    $response->assertNotFound();
});

it('allows fleet manager to list asset documents without a direct dispatch assignment', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    [$asset, $permit] = createAssetWithPermit('CRN-MANAGER');

    $token = $manager->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->getJson(route('api.v1.fleet.assets.permits.index', $asset->code));

    $response->assertOk();
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.documentNumber', 'DPWH-NCR-2026-SP-8821');
});

it('allows assigned operator to download permit attachment file stream', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    [$asset, $permit, $attachment, $fileContent] = createAssetWithPermit('CRN-50');
    assignOperatorToAsset($operator, $asset);

    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->get(route('api.v1.fleet.assets.permits.download', [
            'operationalAsset' => $asset->id,
            'document' => $permit->id,
        ]));

    $response->assertOk();
    $response->assertHeader('Content-Type', 'application/pdf');
    expect($response->streamedContent())->toBe($fileContent);
});

it('prohibits unassigned operator from downloading permit attachment with 403 Forbidden', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    [$asset, $permit] = createAssetWithPermit('CRN-FORBIDDEN');

    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->get(route('api.v1.fleet.assets.permits.download', [
            'operationalAsset' => $asset->id,
            'document' => $permit->id,
        ]));

    $response->assertForbidden();
});

it('allows authorized fleet manager to store a new asset document with file upload and audit event', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-UPLOAD-01',
        'name' => 'Prime Mover',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    $file = UploadedFile::fake()->create('lto_registration.pdf', 300, 'application/pdf');

    $response = $this->actingAs($manager)
        ->postJson(route('operations.fleet.documents.store', $asset->id), [
            'category' => 'road_permits',
            'title' => 'LTO Official Receipt & Certificate of Registration',
            'document_number' => 'LTO-2026-CR-9901',
            'issuing_authority' => 'Land Transportation Office',
            'issued_at' => now()->toDateString(),
            'expires_at' => now()->addYear()->toDateString(),
            'notes' => 'Annual registration renewed.',
            'file' => $file,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.document_number', 'LTO-2026-CR-9901');

    $this->assertDatabaseHas('asset_documents', [
        'operational_asset_id' => $asset->id,
        'document_number' => 'LTO-2026-CR-9901',
        'category' => 'road_permits',
    ]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'asset.document_added',
        'subject_type' => $asset->getMorphClass(),
        'subject_id' => $asset->id,
    ]);
});

it('allows authorized fleet manager to delete an asset document with audit event', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    [$asset, $permit] = createAssetWithPermit('TRK-DELETE-01');
    $asset->update(['kind' => 'truck']);

    $response = $this->actingAs($manager)
        ->deleteJson(route('operations.fleet.documents.destroy', [
            'operationalAsset' => $asset->id,
            'document' => $permit->id,
        ]));

    $response->assertOk();
    $this->assertDatabaseMissing('asset_documents', ['id' => $permit->id]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'asset.document_removed',
        'subject_type' => $asset->getMorphClass(),
        'subject_id' => $asset->id,
    ]);
});

it('prohibits crane operator from uploading asset documents without fleet permission', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-OP-DENIED',
        'name' => '50T Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $file = UploadedFile::fake()->create('permit.pdf', 300, 'application/pdf');

    $response = $this->actingAs($operator)
        ->postJson(route('operations.fleet.documents.store', $asset->id), [
            'category' => 'road_permits',
            'document_number' => 'DENIED-01',
            'file' => $file,
        ]);

    $response->assertForbidden();
});

it('allows authorized fleet manager to update document metadata and status with audit event', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    [$asset, $permit] = createAssetWithPermit('TRK-UPDATE-01');
    $asset->update(['kind' => 'truck']);

    $response = $this->actingAs($manager)
        ->patchJson(route('operations.fleet.documents.update', [
            'operationalAsset' => $asset->id,
            'document' => $permit->id,
        ]), [
            'title' => 'Updated Permit Title',
            'notes' => 'Suspended due to scheduled drydocking.',
            'status' => 'revoked',
        ]);

    $response->assertOk();
    $response->assertJsonPath('data.title', 'Updated Permit Title');
    $response->assertJsonPath('data.status', 'revoked');
    $response->assertJsonPath('data.notes', 'Suspended due to scheduled drydocking.');

    $this->assertDatabaseHas('asset_documents', [
        'id' => $permit->id,
        'title' => 'Updated Permit Title',
        'status' => 'revoked',
    ]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'asset.document_updated',
        'subject_type' => $asset->getMorphClass(),
        'subject_id' => $asset->id,
    ]);
});

it('allows authorized fleet manager to replace document attachment file with audit event', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    [$asset, $permit] = createAssetWithPermit('TRK-REPLACE-01');
    $asset->update(['kind' => 'truck']);

    $newFile = UploadedFile::fake()->create('replacement_permit.pdf', 600, 'application/pdf');

    $response = $this->actingAs($manager)
        ->postJson(route('operations.fleet.documents.replace', [
            'operationalAsset' => $asset->id,
            'document' => $permit->id,
        ]), [
            'file' => $newFile,
            'notes' => 'Superseded with renewed 2027 permit.',
        ]);

    $response->assertOk();
    $this->assertDatabaseHas('audit_events', [
        'action' => 'asset.document_replaced',
        'subject_type' => $asset->getMorphClass(),
        'subject_id' => $asset->id,
    ]);

    $permit->refresh();
    expect($permit->notes)->toBe('Superseded with renewed 2027 permit.');
    expect($permit->latestAttachment)->not->toBeNull();
    expect($permit->latestAttachment->original_filename)->toBe('replacement_permit.pdf');
});

it('prohibits unauthorized view-only user from updating or replacing asset documents', function (): void {
    $rigger = User::factory()->create(['is_active' => true]);
    $rigger->syncRoles([RoleName::Rigger->value]);

    [$asset, $permit] = createAssetWithPermit('CRN-NO-PERM');

    $this->actingAs($rigger)
        ->patchJson(route('operations.fleet.documents.update', [
            'operationalAsset' => $asset->id,
            'document' => $permit->id,
        ]), ['title' => 'Hacked Title'])
        ->assertForbidden();

    $newFile = UploadedFile::fake()->create('hacked.pdf', 200, 'application/pdf');
    $this->actingAs($rigger)
        ->postJson(route('operations.fleet.documents.replace', [
            'operationalAsset' => $asset->id,
            'document' => $permit->id,
        ]), ['file' => $newFile])
        ->assertForbidden();

    // Also verify CraneOperator cannot modify truck fleet documents
    [$truck, $truckPermit] = createAssetWithPermit('TRK-NO-PERM');
    $truck->update(['kind' => 'truck']);

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $this->actingAs($operator)
        ->patchJson(route('operations.fleet.documents.update', [
            'operationalAsset' => $truck->id,
            'document' => $truckPermit->id,
        ]), ['title' => 'Hacked Truck Title'])
        ->assertForbidden();
});

it('rejects updating, replacing, or deleting document belonging to another asset with 404', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    [$asset1, $permit1] = createAssetWithPermit('ASSET-01');
    [$asset2] = createAssetWithPermit('ASSET-02');
    $asset1->update(['kind' => 'truck']);
    $asset2->update(['kind' => 'truck']);

    // Attempting to operate on permit1 via asset2
    $this->actingAs($manager)
        ->patchJson(route('operations.fleet.documents.update', [
            'operationalAsset' => $asset2->id,
            'document' => $permit1->id,
        ]), ['title' => 'Cross-Asset Mod'])
        ->assertNotFound();

    $newFile = UploadedFile::fake()->create('file.pdf', 200, 'application/pdf');
    $this->actingAs($manager)
        ->postJson(route('operations.fleet.documents.replace', [
            'operationalAsset' => $asset2->id,
            'document' => $permit1->id,
        ]), ['file' => $newFile])
        ->assertNotFound();

    $this->actingAs($manager)
        ->deleteJson(route('operations.fleet.documents.destroy', [
            'operationalAsset' => $asset2->id,
            'document' => $permit1->id,
        ]))
        ->assertNotFound();
});

it('physically deletes attachments from storage upon document deletion', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    [$asset, $permit, $attachment] = createAssetWithPermit('TRK-PHYSICAL-01');
    $asset->update(['kind' => 'truck']);

    expect(Storage::disk('private')->exists($attachment->path))->toBeTrue();

    $this->actingAs($manager)
        ->deleteJson(route('operations.fleet.documents.destroy', [
            'operationalAsset' => $asset->id,
            'document' => $permit->id,
        ]))
        ->assertOk();

    expect(Storage::disk('private')->exists($attachment->path))->toBeFalse();
    $this->assertDatabaseMissing('attachments', ['id' => $attachment->id]);
});

it('allows authorized user to download asset document attachment via web download route', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    [$asset, $permit, $attachment, $fileContent] = createAssetWithPermit('TRK-WEB-DL');

    $response = $this->actingAs($manager)
        ->get("/operations/attachments/{$attachment->id}/download");

    $response->assertOk();
    expect($response->streamedContent())->toBe($fileContent);
});
