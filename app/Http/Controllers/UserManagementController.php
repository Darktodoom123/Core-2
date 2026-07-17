<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\User;
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
        $validated = $request->validate(['name' => ['required', 'string', 'max:255'], 'email' => ['required', 'email', 'max:255', 'unique:users,email'], 'role' => ['required', Rule::enum(RoleName::class)]]);

        $user = DB::transaction(function () use ($request, $validated, $audit): User {
            $user = User::query()->create(['name' => $validated['name'], 'email' => Str::lower($validated['email']), 'password' => Hash::make(Str::password(40)), 'is_active' => true]);
            $user->syncRoles([$validated['role']]);
            $audit->handle($request->user(), $user, 'user.invited', null, ['email' => $user->email, 'role' => $validated['role']]);

            return $user->load('roles:id,name');
        });

        return response()->json(['data' => $user], 201);
    }

    public function update(Request $request, User $user, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        $validated = $request->validate(['role' => ['sometimes', Rule::enum(RoleName::class)], 'is_active' => ['sometimes', 'boolean']]);
        $currentRole = $user->operationalRole();
        $removesAdministrator = $currentRole === RoleName::SystemAdministrator
            && (($validated['role'] ?? $currentRole->value) !== RoleName::SystemAdministrator->value || ($validated['is_active'] ?? true) === false);

        if (($user->is($request->user()) && ($validated['is_active'] ?? true) === false) || ($removesAdministrator && $this->activeAdministratorCount() <= 1)) {
            throw ValidationException::withMessages(['user' => 'The last active System Administrator cannot be suspended or demoted.']);
        }

        DB::transaction(function () use ($request, $user, $validated, $audit, $currentRole): void {
            if (array_key_exists('role', $validated)) {
                $user->syncRoles([$validated['role']]);
            }
            if (array_key_exists('is_active', $validated)) {
                $user->update(['is_active' => $validated['is_active'], 'suspended_at' => $validated['is_active'] ? null : now()]);
            }
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $audit->handle($request->user(), $user, 'user.access_updated', ['role' => $currentRole?->value, 'is_active' => ! $user->suspended_at], ['role' => $user->operationalRole()?->value, 'is_active' => $user->is_active]);
        });

        return response()->json(['data' => $user->refresh()->load('roles:id,name')]);
    }

    private function activeAdministratorCount(): int
    {
        return User::role(RoleName::SystemAdministrator->value)->where('is_active', true)->whereNull('suspended_at')->count();
    }
}
