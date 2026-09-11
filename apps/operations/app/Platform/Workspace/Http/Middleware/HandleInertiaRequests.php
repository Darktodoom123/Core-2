<?php

namespace App\Platform\Workspace\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

final class HandleInertiaRequests extends Middleware
{
    /** @var string */
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $role = $user?->operationalRole();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'is_local_env' => app()->environment('local'),
            'flash' => fn (): mixed => $request->session()->get('flash'),
            'auth' => [
                'user' => $user,
                'role' => $role?->value,
                'role_label' => $role?->label(),
                'prototype_role' => $role?->prototypeValue(),
                'permissions' => fn (): array => $user?->getAllPermissions()
                    ->pluck('name')->sort()->values()->all() ?? [],
            ],
        ];
    }
}
