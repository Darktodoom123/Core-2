<?php

namespace App\Platform\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
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

    public function storeCredential(Request $request, User $user, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        $validated = $request->validate([
            'kind' => ['required', 'in:driver_license,operator_certification,qualification'],
            'credential_number' => ['required', 'string', 'max:96'],
            'credential_type' => ['required', 'string', 'max:64'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
        ]);
        $credential = PersonnelCredential::query()->create([
            ...$validated,
            'user_id' => $user->id,
            'status' => 'active',
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
        ]);
        $audit->handle($request->user(), $user, 'personnel.credential_added', null, ['credential_id' => $credential->id, 'kind' => $credential->kind]);

        return response()->json(['data' => $credential], 201);
    }

    public function destroyCredential(Request $request, User $user, PersonnelCredential $credential, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        abort_unless($credential->user_id === $user->id, 404);

        $credentialData = $credential->toArray();
        $credential->delete();

        $audit->handle($request->user(), $user, 'personnel.credential_removed', $credentialData, null);

        return response()->json(['message' => 'Credential removed successfully.']);
    }
}
