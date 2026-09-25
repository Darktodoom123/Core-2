<?php

namespace App\Platform\Identity\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\IpLocationResolver;
use App\Platform\Identity\Support\UserAgentParser;
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
    public function index(Request $request): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);

        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role' => ['sometimes', 'nullable', Rule::enum(RoleName::class)],
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'suspended'])],
        ]);

        $search = trim((string) ($filters['search'] ?? ''));

        return response()->json([
            'data' => User::query()
                ->select(['id', 'name', 'username', 'email', 'phone', 'is_active', 'suspended_at', 'email_otp_enabled'])
                ->with('roles:id,name')
                ->when($search !== '', function ($query) use ($search): void {
                    $term = '%'.mb_strtolower($search).'%';

                    $query->where(function ($query) use ($term): void {
                        $query->whereRaw('LOWER(name) LIKE ?', [$term])
                            ->orWhereRaw('LOWER(username) LIKE ?', [$term])
                            ->orWhereRaw('LOWER(email) LIKE ?', [$term]);
                    });
                })
                ->when(isset($filters['role']) && $filters['role'] !== '', fn ($query) => $query->whereHas('roles', fn ($roles) => $roles->where('name', $filters['role'])))
                ->when(isset($filters['status']) && $filters['status'] !== '', function ($query) use ($filters): void {
                    if ($filters['status'] === 'active') {
                        $query->where('is_active', true)->whereNull('suspended_at');

                        return;
                    }

                    $query->where(function ($query): void {
                        $query->where('is_active', false)->orWhereNotNull('suspended_at');
                    });
                })
                ->orderBy('name')
                ->orderBy('id')
                ->paginate(50)
                ->withQueryString(),
            'active_system_administrators' => User::role(RoleName::SystemAdministrator->value)
                ->where('is_active', true)
                ->whereNull('suspended_at')
                ->count(),
        ]);
    }

    public function signInActivity(Request $request, string $userId): JsonResponse
    {
        Gate::authorize(PermissionName::UsersManage->value);
        Gate::authorize(PermissionName::AuditView->value);

        $pagination = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        $user = User::query()->findOrFail($userId);
        $perPage = (int) ($pagination['per_page'] ?? 10);
        $page = (int) ($pagination['page'] ?? 1);

        $activity = AuditEvent::query()
            ->where('subject_type', $user->getMorphClass())
            ->where('subject_id', (string) $user->getKey())
            ->whereIn('action', ['user.login', 'user.logout'])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['id', 'action', 'after', 'ip_address', 'occurred_at'], 'page', $page);

        $events = collect($activity->items())->map(static function (AuditEvent $event): array {
            /** @var array<string, mixed> $after */
            $after = is_array($event->after) ? $event->after : [];
            $userAgent = isset($after['user_agent']) && is_string($after['user_agent']) && trim($after['user_agent']) !== ''
                ? $after['user_agent']
                : null;
            $deviceInfo = $userAgent !== null ? UserAgentParser::parse($userAgent) : null;
            $device = isset($after['device']) && is_string($after['device']) && trim($after['device']) !== ''
                ? $after['device']
                : ($deviceInfo['label'] ?? 'Unknown device');

            return [
                'id' => $event->id,
                'event_label' => $event->action === 'user.login' ? 'Signed in' : 'Signed out',
                'device_label' => $device,
                'device_type' => $deviceInfo === null
                    ? null
                    : ($deviceInfo['platform'] === 'Unknown Platform' ? 'unknown' : $deviceInfo['device_type']),
                'location' => IpLocationResolver::resolve($event->ip_address),
                'ip_address' => $event->ip_address ?: 'Unknown IP',
                'occurred_at' => $event->occurred_at?->toIso8601String(),
                'occurred_at_human' => $event->occurred_at?->diffForHumans(),
            ];
        })->values();

        return response()->json([
            'data' => $events,
            'current_page' => $activity->currentPage(),
            'last_page' => $activity->lastPage(),
            'per_page' => $activity->perPage(),
            'total' => $activity->total(),
        ]);
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
            'role' => ['required', Rule::in($this->assignableRoles())],
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
            $audit->handle($request->user(), $user, 'user.created', null, [
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
            $user->trustedDevices()->delete();
            $user->deviceTokens()->active()->update(['is_active' => false, 'revoked_at' => now()]);
            EmailOneTimeCode::query()->where('user_id', $user->id)->delete();
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
        $validated = $request->validate(['role' => ['sometimes', Rule::in($this->assignableRoles())], 'is_active' => ['sometimes', 'boolean']]);
        $updatedUser = DB::transaction(function () use ($request, $user, $validated, $audit): User {
            /** @var User $user */
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            $requestedActive = array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $user->is_active;
            $currentRole = $user->operationalRole();
            $nextRole = $validated['role'] ?? $currentRole?->value;
            $removesAdministrator = $currentRole === RoleName::SystemAdministrator
                && ($nextRole !== RoleName::SystemAdministrator->value || ! $requestedActive);

            if ($user->is($request->user()) && ! $requestedActive) {
                throw ValidationException::withMessages(['user' => 'You cannot suspend your own account.']);
            }

            if ($removesAdministrator) {
                $activeAdministrators = User::query()
                    ->role(RoleName::SystemAdministrator->value)
                    ->where('is_active', true)
                    ->whereNull('suspended_at')
                    ->orderBy('users.id')
                    ->lockForUpdate()
                    ->get(['users.id']);

                if ($activeAdministrators->count() <= 1) {
                    throw ValidationException::withMessages(['user' => 'The last active System Administrator cannot be suspended or demoted.']);
                }
            }

            $wasActive = $user->is_active && $user->suspended_at === null;
            $roleChanged = array_key_exists('role', $validated) && $nextRole !== $currentRole?->value;

            if (array_key_exists('role', $validated)) {
                $user->syncRoles([$validated['role']]);
            }
            if (array_key_exists('is_active', $validated)) {
                $isActive = (bool) $validated['is_active'];
                $user->update(['is_active' => $isActive, 'suspended_at' => $isActive ? null : now()]);

                if (! $isActive || $roleChanged) {
                    $user->tokens()->delete();
                    $user->trustedDevices()->delete();
                    $user->deviceTokens()->active()->update(['is_active' => false, 'revoked_at' => now()]);
                    EmailOneTimeCode::query()->where('user_id', $user->id)->delete();
                }
            } elseif ($roleChanged) {
                $user->tokens()->delete();
                $user->trustedDevices()->delete();
                $user->deviceTokens()->active()->update(['is_active' => false, 'revoked_at' => now()]);
                EmailOneTimeCode::query()->where('user_id', $user->id)->delete();
            }
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $audit->handle($request->user(), $user, 'user.access_updated', ['role' => $currentRole?->value, 'is_active' => $wasActive], ['role' => $user->operationalRole()?->value, 'is_active' => $user->is_active && $user->suspended_at === null]);

            return $user->refresh()->load('roles:id,name');
        });

        return response()->json(['data' => $updatedUser]);
    }

    /** @return list<string> */
    private function assignableRoles(): array
    {
        return [
            RoleName::SystemAdministrator->value,
            RoleName::OperationsManager->value,
            RoleName::CraneOperator->value,
        ];
    }
}
