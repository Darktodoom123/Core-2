<?php

namespace App\Platform\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class UserManagementController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);

        return response()->json(['data' => User::query()->with('roles:id,name')->orderBy('name')->paginate(50)]);
    }

    public function store(Request $request, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        $email = $request->input('email');
        $username = $request->input('username');

        $request->merge([
            'email' => is_string($email) ? Str::lower(trim($email)) : $email,
            'username' => is_string($username) ? Username::normalize($username) : $username,
        ]);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', ...Username::validationRules(), Rule::unique('users', 'username')],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:32'],
            'role' => ['required', Rule::enum(RoleName::class)],
            'generate_temp_password' => ['sometimes', 'boolean'],
        ]);

        $tempPassword = ! empty($validated['generate_temp_password'])
            ? Str::password(14, true, true, false)
            : null;

        $user = DB::transaction(function () use ($request, $validated, $tempPassword, $audit): User {
            $user = User::query()->create([
                'name' => $validated['name'],
                'username' => $validated['username'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($tempPassword ?? Str::password(40)),
                'is_active' => true,
                'email_verified_at' => $tempPassword !== null ? now() : null,
            ]);
            $user->syncRoles([$validated['role']]);
            $audit->handle($request->user(), $user, 'user.invited', null, [
                'email' => $user->email,
                'role' => $validated['role'],
                'has_temp_password' => $tempPassword !== null,
            ]);

            return $user->load('roles:id,name');
        });

        return response()->json([
            'data' => $user,
            'temporary_password' => $tempPassword,
        ], 201);
    }

    public function resetPassword(Request $request, User $user, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);

        $tempPassword = Str::password(14, true, true, false);

        DB::transaction(function () use ($request, $user, $tempPassword, $audit): void {
            $user->update([
                'password' => Hash::make($tempPassword),
                'email_verified_at' => $user->email_verified_at ?? now(),
            ]);
            $user->tokens()->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();

            $audit->handle($request->user(), $user, 'user.password_reset', null, [
                'user_id' => $user->id,
            ]);
        });

        return response()->json([
            'message' => 'Temporary password generated successfully.',
            'temporary_password' => $tempPassword,
        ]);
    }

    public function update(Request $request, User $user, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        $validated = $request->validate(['role' => ['sometimes', Rule::enum(RoleName::class)], 'is_active' => ['sometimes', 'boolean']]);
        $updatedUser = DB::transaction(function () use ($request, $user, $validated, $audit): User {
            /** @var User $user */
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            $requestedActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $user->is_active;
            $currentRole = $user->operationalRole();
            $nextRole = $validated['role'] ?? $currentRole?->value;
            $removesAdministrator = $currentRole === RoleName::SystemAdministrator
                && ($nextRole !== RoleName::SystemAdministrator->value || ! $requestedActive);
            $activeAdministrators = User::query()
                ->role(RoleName::SystemAdministrator->value)
                ->where('is_active', true)
                ->whereNull('suspended_at')
                ->lockForUpdate()
                ->get(['users.id']);

            if (($user->is($request->user()) && ! $requestedActive) || ($removesAdministrator && $activeAdministrators->count() <= 1)) {
                throw ValidationException::withMessages(['user' => 'The last active System Administrator cannot be suspended or demoted.']);
            }

            $roleChanged = array_key_exists('role', $validated) && $nextRole !== $currentRole?->value;

            if (array_key_exists('role', $validated)) {
                $user->syncRoles([$validated['role']]);
            }
            if (array_key_exists('is_active', $validated)) {
                $isActive = (bool) $validated['is_active'];
                $user->update(['is_active' => $isActive, 'suspended_at' => $isActive ? null : now()]);

                if (! $isActive || $roleChanged) {
                    $user->tokens()->delete();
                }
            } elseif ($roleChanged) {
                $user->tokens()->delete();
            }
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $audit->handle($request->user(), $user, 'user.access_updated', ['role' => $currentRole?->value, 'is_active' => ! $user->suspended_at], ['role' => $user->operationalRole()?->value, 'is_active' => $user->is_active]);

            return $user->refresh()->load('roles:id,name');
        });

        return response()->json(['data' => $updatedUser]);
    }
}
