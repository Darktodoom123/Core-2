<?php

use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

it('allows authenticated user to list their own personnel credentials with validity status', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $otherUser = User::factory()->create(['is_active' => true]);

    $cred1 = PersonnelCredential::query()->create([
        'user_id' => $operator->id,
        'kind' => 'operator_certification',
        'credential_type' => 'tesda_nc3',
        'credential_number' => 'TESDA-NC3-99102',
        'issuing_authority' => 'Technical Education and Skills Development Authority',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYears(2),
        'notes' => 'Certified for heavy mobile crane operations.',
    ]);

    $file = UploadedFile::fake()->create('tesda_cert.pdf', 500, 'application/pdf');
    $path = $file->store('attachments/credentials', 'private');

    Attachment::query()->create([
        'disk' => 'private',
        'path' => $path,
        'original_filename' => 'tesda_cert.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 512000,
        'checksum_sha256' => hash('sha256', 'dummy'),
        'uploaded_by' => $operator->id,
        'kind' => 'credential_document',
        'owner_type' => $cred1->getMorphClass(),
        'owner_id' => $cred1->id,
    ]);

    // Other user's credential should not appear
    PersonnelCredential::query()->create([
        'user_id' => $otherUser->id,
        'kind' => 'driver_license',
        'credential_type' => 'driver_license_professional',
        'credential_number' => 'LTO-DL-OTHER',
        'issuing_authority' => 'LTO',
        'issued_at' => now()->subMonths(6),
        'expires_at' => now()->addYear(),
    ]);

    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->getJson(route('api.v1.personnel.credentials.index'));

    $response->assertOk();
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.id', (string) $cred1->id);
    $response->assertJsonPath('data.0.documentNumber', 'TESDA-NC3-99102');
    $response->assertJsonPath('data.0.issuingAuthority', 'Technical Education and Skills Development Authority');
    $response->assertJsonPath('data.0.status', 'valid');
    $response->assertJsonPath('data.0.isExpired', false);
    $response->assertJsonPath('data.0.notes', 'Certified for heavy mobile crane operations.');
    expect($response->json('data.0.fileUri'))->not->toBeNull();
});

it('prohibits unauthenticated requests to personnel credentials', function (): void {
    $response = $this->getJson(route('api.v1.personnel.credentials.index'));
    $response->assertUnauthorized();
});

it('allows operator to download their own credential file stream', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $cred = PersonnelCredential::query()->create([
        'user_id' => $operator->id,
        'kind' => 'operator_certification',
        'credential_type' => 'tesda_nc3',
        'credential_number' => 'TESDA-NC3-99102',
        'issuing_authority' => 'TESDA',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYears(2),
    ]);

    $fileContent = '%PDF-1.4 test document content';
    $path = 'attachments/credentials/test_cert.pdf';
    Storage::disk('private')->put($path, $fileContent);

    Attachment::query()->create([
        'disk' => 'private',
        'path' => $path,
        'original_filename' => 'test_cert.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => strlen($fileContent),
        'checksum_sha256' => hash('sha256', 'dummy'),
        'uploaded_by' => $operator->id,
        'kind' => 'credential_document',
        'owner_type' => $cred->getMorphClass(),
        'owner_id' => $cred->id,
    ]);

    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->get(route('api.v1.personnel.credentials.download', $cred->id));

    $response->assertOk();
    $response->assertHeader('Content-Type', 'application/pdf');
    expect($response->streamedContent())->toBe($fileContent);
});

it('strictly rejects cross-user credential attachment download with 403 Forbidden', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $otherUser = User::factory()->create(['is_active' => true]);
    $otherUser->syncRoles([RoleName::CraneOperator->value]);

    $otherCred = PersonnelCredential::query()->create([
        'user_id' => $otherUser->id,
        'kind' => 'operator_certification',
        'credential_type' => 'tesda_nc3',
        'credential_number' => 'TESDA-NC3-OTHER',
        'issuing_authority' => 'TESDA',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYears(2),
    ]);

    $fileContent = '%PDF-1.4 secret cert';
    $path = 'attachments/credentials/other_cert.pdf';
    Storage::disk('private')->put($path, $fileContent);

    Attachment::query()->create([
        'disk' => 'private',
        'path' => $path,
        'original_filename' => 'other_cert.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => strlen($fileContent),
        'checksum_sha256' => hash('sha256', 'dummy'),
        'uploaded_by' => $otherUser->id,
        'kind' => 'credential_document',
        'owner_type' => $otherCred->getMorphClass(),
        'owner_id' => $otherCred->id,
    ]);

    // Unauthorized operator attempting to download otherUser's credential
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->get(route('api.v1.personnel.credentials.download', $otherCred->id));

    $response->assertForbidden();
});

it('returns 404 if credential has no attachment file', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $cred = PersonnelCredential::query()->create([
        'user_id' => $operator->id,
        'kind' => 'operator_certification',
        'credential_type' => 'tesda_nc3',
        'credential_number' => 'TESDA-NC3-NOATTACH',
        'issuing_authority' => 'TESDA',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYears(2),
    ]);

    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $response = $this->withToken($token)
        ->get(route('api.v1.personnel.credentials.download', $cred->id));

    $response->assertNotFound();
});

it('allows administrator to store a personnel credential with file upload and audit event', function (): void {
    $admin = User::factory()->create(['is_active' => true]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $file = UploadedFile::fake()->create('tesda_nc2.pdf', 400, 'application/pdf');

    $response = $this->actingAs($admin)
        ->postJson("/operations/users/{$operator->id}/credentials", [
            'kind' => 'operator_certification',
            'credential_number' => 'TESDA-NC2-77112',
            'credential_type' => 'Heavy Crane NC-II',
            'issuing_authority' => 'TESDA Central Office',
            'issued_at' => now()->toDateString(),
            'expires_at' => now()->addYears(3)->toDateString(),
            'notes' => 'Certified for 50T mobile cranes.',
            'file' => $file,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.credential_number', 'TESDA-NC2-77112');

    $this->assertDatabaseHas('personnel_credentials', [
        'user_id' => $operator->id,
        'credential_number' => 'TESDA-NC2-77112',
        'status' => 'active',
    ]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'personnel.credential_added',
        'subject_type' => $operator->getMorphClass(),
        'subject_id' => $operator->id,
    ]);
});

it('allows administrator to update credential metadata and status with audit event', function (): void {
    $admin = User::factory()->create(['is_active' => true]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $operator = User::factory()->create(['is_active' => true]);

    $cred = PersonnelCredential::query()->create([
        'user_id' => $operator->id,
        'kind' => 'driver_license',
        'credential_type' => 'driver_license_professional',
        'credential_number' => 'LTO-DL-REVOKED',
        'status' => 'active',
    ]);

    $response = $this->actingAs($admin)
        ->patchJson("/operations/users/{$operator->id}/credentials/{$cred->id}", [
            'notes' => 'License suspended due to pending medical clearance.',
            'status' => 'revoked',
        ]);

    $response->assertOk();
    $response->assertJsonPath('data.status', 'revoked');
    $response->assertJsonPath('data.notes', 'License suspended due to pending medical clearance.');

    $this->assertDatabaseHas('personnel_credentials', [
        'id' => $cred->id,
        'status' => 'revoked',
    ]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'personnel.credential_updated',
        'subject_type' => $operator->getMorphClass(),
        'subject_id' => $operator->id,
    ]);
});

it('allows administrator to replace credential file with audit event', function (): void {
    $admin = User::factory()->create(['is_active' => true]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $operator = User::factory()->create(['is_active' => true]);

    $cred = PersonnelCredential::query()->create([
        'user_id' => $operator->id,
        'kind' => 'operator_certification',
        'credential_type' => 'Heavy Crane NC-II',
        'credential_number' => 'TESDA-REPLACE-01',
        'status' => 'active',
    ]);

    $newFile = UploadedFile::fake()->create('tesda_renewed.pdf', 600, 'application/pdf');

    $response = $this->actingAs($admin)
        ->postJson("/operations/users/{$operator->id}/credentials/{$cred->id}/replace", [
            'file' => $newFile,
            'notes' => 'Superseded by 5-year renewal certificate.',
            'expires_at' => now()->addYears(5)->toDateString(),
        ]);

    $response->assertOk();
    $this->assertDatabaseHas('audit_events', [
        'action' => 'personnel.credential_replaced',
        'subject_type' => $operator->getMorphClass(),
        'subject_id' => $operator->id,
    ]);

    $cred->refresh();
    expect($cred->notes)->toBe('Superseded by 5-year renewal certificate.');
    expect($cred->latestAttachment)->not->toBeNull();
    expect($cred->latestAttachment->original_filename)->toBe('tesda_renewed.pdf');
});

it('allows administrator to delete credential and physically deletes attachment from storage', function (): void {
    $admin = User::factory()->create(['is_active' => true]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $operator = User::factory()->create(['is_active' => true]);

    $cred = PersonnelCredential::query()->create([
        'user_id' => $operator->id,
        'kind' => 'operator_certification',
        'credential_type' => 'Heavy Crane NC-II',
        'credential_number' => 'TESDA-DEL-01',
        'status' => 'active',
    ]);

    $filePath = "attachments/credentials/test_delete_{$cred->id}.pdf";
    Storage::disk('private')->put($filePath, '%PDF-1.4 delete test');

    $attachment = Attachment::query()->create([
        'disk' => 'private',
        'path' => $filePath,
        'original_filename' => 'test_delete.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 100,
        'checksum_sha256' => hash('sha256', 'dummy'),
        'uploaded_by' => $admin->id,
        'kind' => 'credential_document',
        'owner_type' => $cred->getMorphClass(),
        'owner_id' => $cred->id,
    ]);

    expect(Storage::disk('private')->exists($filePath))->toBeTrue();

    $this->actingAs($admin)
        ->deleteJson("/operations/users/{$operator->id}/credentials/{$cred->id}")
        ->assertOk();

    expect(Storage::disk('private')->exists($filePath))->toBeFalse();
    $this->assertDatabaseMissing('personnel_credentials', ['id' => $cred->id]);
    $this->assertDatabaseMissing('attachments', ['id' => $attachment->id]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'personnel.credential_removed',
        'subject_type' => $operator->getMorphClass(),
        'subject_id' => $operator->id,
    ]);
});

it('prohibits unauthorized view-only user from managing credentials', function (): void {
    $rigger = User::factory()->create(['is_active' => true]);
    $rigger->syncRoles([RoleName::Rigger->value]);

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $cred = PersonnelCredential::query()->create([
        'user_id' => $operator->id,
        'kind' => 'operator_certification',
        'credential_type' => 'Heavy Crane NC-II',
        'credential_number' => 'TESDA-UNAUTH',
        'status' => 'active',
    ]);

    $this->actingAs($rigger)
        ->postJson("/operations/users/{$operator->id}/credentials", [
            'kind' => 'operator_certification',
            'credential_number' => 'TESDA-HACK',
            'credential_type' => 'Heavy Crane NC-II',
        ])
        ->assertForbidden();

    $this->actingAs($rigger)
        ->patchJson("/operations/users/{$operator->id}/credentials/{$cred->id}", [
            'notes' => 'Hacked Notes',
        ])
        ->assertForbidden();

    $newFile = UploadedFile::fake()->create('hacked.pdf', 100, 'application/pdf');
    $this->actingAs($rigger)
        ->postJson("/operations/users/{$operator->id}/credentials/{$cred->id}/replace", [
            'file' => $newFile,
        ])
        ->assertForbidden();

    $this->actingAs($rigger)
        ->deleteJson("/operations/users/{$operator->id}/credentials/{$cred->id}")
        ->assertForbidden();
});

it('rejects managing a credential belonging to another user with 404', function (): void {
    $admin = User::factory()->create(['is_active' => true]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $userA = User::factory()->create(['is_active' => true]);
    $userB = User::factory()->create(['is_active' => true]);

    $credA = PersonnelCredential::query()->create([
        'user_id' => $userA->id,
        'kind' => 'driver_license',
        'credential_type' => 'driver_license_professional',
        'credential_number' => 'LTO-USER-A',
        'status' => 'active',
    ]);

    // Operating on User A's credential under User B's route
    $this->actingAs($admin)
        ->patchJson("/operations/users/{$userB->id}/credentials/{$credA->id}", [
            'notes' => 'Cross-user update',
        ])
        ->assertNotFound();

    $newFile = UploadedFile::fake()->create('hacked.pdf', 100, 'application/pdf');
    $this->actingAs($admin)
        ->postJson("/operations/users/{$userB->id}/credentials/{$credA->id}/replace", [
            'file' => $newFile,
        ])
        ->assertNotFound();

    $this->actingAs($admin)
        ->deleteJson("/operations/users/{$userB->id}/credentials/{$credA->id}")
        ->assertNotFound();
});

it('allows authorized user to download credential attachment via web download route', function (): void {
    $admin = User::factory()->create(['is_active' => true]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $operator = User::factory()->create(['is_active' => true]);

    $cred = PersonnelCredential::query()->create([
        'user_id' => $operator->id,
        'kind' => 'driver_license',
        'credential_type' => 'driver_license_professional',
        'credential_number' => 'LTO-WEB-DL',
        'status' => 'active',
    ]);

    $fileContent = '%PDF-1.4 official license scan';
    $path = "attachments/credentials/web_dl_{$cred->id}.pdf";
    Storage::disk('private')->put($path, $fileContent);

    $attachment = Attachment::query()->create([
        'disk' => 'private',
        'path' => $path,
        'original_filename' => 'license.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => strlen($fileContent),
        'checksum_sha256' => hash('sha256', $fileContent),
        'uploaded_by' => $admin->id,
        'kind' => 'credential_document',
        'owner_type' => $cred->getMorphClass(),
        'owner_id' => $cred->id,
    ]);

    $response = $this->actingAs($admin)
        ->get("/operations/attachments/{$attachment->id}/download");

    $response->assertOk();
    expect($response->streamedContent())->toBe($fileContent);

    // Operator downloading their own credential attachment
    $this->actingAs($operator)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertOk();

    // Another operator downloading without permission
    $otherOperator = User::factory()->create(['is_active' => true]);
    $otherOperator->syncRoles([RoleName::CraneOperator->value]);

    $this->actingAs($otherOperator)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertForbidden();
});
