<?php

namespace App\Platform\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

final class PersonnelController extends Controller
{
    public function updateProfile(Request $request, User $user, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        $validated = $request->validate([
            'employee_number' => ['nullable', 'string', 'max:48', Rule::unique('personnel_profiles')->ignore($user->personnelProfile?->id)],
            'availability_status' => ['required', 'in:available,assigned,unavailable,on_leave'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:32'],
        ]);
        $profile = $user->personnelProfile()->updateOrCreate(['user_id' => $user->id], $validated);
        $audit->handle($request->user(), $user, 'personnel.profile_updated', null, $profile->toArray());

        return response()->json(['data' => $profile]);
    }

    public function storeCredential(Request $request, User $user, RecordAuditEvent $audit, UploadAttachmentAction $uploadAction): JsonResponse|RedirectResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        $validated = $request->validate([
            'kind' => ['required', 'in:driver_license,operator_certification,qualification'],
            'credential_number' => ['required', 'string', 'max:96'],
            'credential_type' => ['required', 'string', 'max:64'],
            'issuing_authority' => ['nullable', 'string', 'max:128'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'file' => ['nullable', 'file', 'max:10240', 'mimetypes:application/pdf,image/jpeg,image/png,image/heic'],
        ]);

        $credential = PersonnelCredential::query()->create([
            'kind' => $validated['kind'],
            'credential_number' => $validated['credential_number'],
            'credential_type' => $validated['credential_type'],
            'issuing_authority' => $validated['issuing_authority'] ?? null,
            'issued_at' => $validated['issued_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'user_id' => $user->id,
            'status' => 'active',
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
        ]);

        $attachmentId = null;
        if ($request->hasFile('file')) {
            try {
                $attachment = $uploadAction->execute(
                    uploader: $request->user(),
                    owner: $credential,
                    file: $request->file('file'),
                    kind: 'personnel_credential'
                );
                $attachmentId = $attachment->id;
            } catch (\Throwable $e) {
                $credential->delete();
                throw $e;
            }
        }

        $audit->handle($request->user(), $user, 'personnel.credential_added', null, ['credential_id' => $credential->id, 'kind' => $credential->kind, 'attachment_id' => $attachmentId]);

        if ($request->header('X-Inertia')) {
            return back()->with('status', 'Credential added successfully.');
        }

        return response()->json(['data' => $credential->load('latestAttachment')], 201);
    }

    public function updateCredential(Request $request, User $user, PersonnelCredential $credential, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        abort_unless($credential->user_id === $user->id, 404);

        $validated = $request->validate([
            'kind' => ['sometimes', 'in:driver_license,operator_certification,qualification'],
            'credential_number' => ['sometimes', 'string', 'max:96'],
            'credential_type' => ['sometimes', 'string', 'max:64'],
            'issuing_authority' => ['nullable', 'string', 'max:128'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'in:active,revoked,superseded'],
        ]);

        $before = $credential->toArray();
        $credential->update($validated);

        $audit->handle($request->user(), $user, 'personnel.credential_updated', $before, $credential->fresh()->toArray());

        if ($request->header('X-Inertia')) {
            return back()->with('status', 'Credential updated successfully.');
        }

        return response()->json(['data' => $credential->fresh()->load('latestAttachment')]);
    }

    public function replaceCredential(Request $request, User $user, PersonnelCredential $credential, UploadAttachmentAction $uploadAction, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        abort_unless($credential->user_id === $user->id, 404);

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimetypes:application/pdf,image/jpeg,image/png,image/heic'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'expires_at' => ['nullable', 'date'],
        ]);

        if (array_key_exists('notes', $validated)) {
            $credential->notes = $validated['notes'];
        }
        if (array_key_exists('expires_at', $validated)) {
            $credential->expires_at = $validated['expires_at'];
        }
        $credential->save();

        $attachment = $uploadAction->execute(
            uploader: $request->user(),
            owner: $credential,
            file: $request->file('file'),
            kind: 'personnel_credential'
        );

        // Safely remove older attachments belonging only to this credential
        $credential->attachments()->where('id', '!=', $attachment->id)->each(function ($old): void {
            if (Storage::disk($old->disk)->exists($old->path)) {
                Storage::disk($old->disk)->delete($old->path);
            }
            $old->delete();
        });

        $audit->handle($request->user(), $user, 'personnel.credential_replaced', null, [
            'credential_id' => $credential->id,
            'attachment_id' => $attachment->id,
        ]);

        if ($request->header('X-Inertia')) {
            return back()->with('status', 'Credential file replaced successfully.');
        }

        return response()->json(['data' => $credential->fresh()->load('latestAttachment')]);
    }

    public function destroyCredential(Request $request, User $user, PersonnelCredential $credential, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        abort_unless($credential->user_id === $user->id, 404);

        $credentialData = $credential->toArray();

        // Safely remove only attachments belonging to this record
        $credential->attachments()->each(function ($attachment): void {
            if (Storage::disk($attachment->disk)->exists($attachment->path)) {
                Storage::disk($attachment->disk)->delete($attachment->path);
            }
            $attachment->delete();
        });

        $credential->delete();

        $audit->handle($request->user(), $user, 'personnel.credential_removed', $credentialData, null);

        if ($request->header('X-Inertia')) {
            return back()->with('status', 'Credential removed successfully.');
        }

        return response()->json(['message' => 'Credential removed successfully.']);
    }
}
