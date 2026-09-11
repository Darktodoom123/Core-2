<?php

namespace App\Platform\Safety\Services;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Collection;

final class SosRecipientResolver
{
    /**
     * @return Collection<int, array{user: User, role_at_alert: string, resolution_reason: string}>
     */
    public function resolve(User $worker, ?DispatchJob $job): Collection
    {
        /** @var Collection<int, array{user: User, role_at_alert: string, resolution_reason: string}> $recipients */
        $recipients = collect();

        $manager = $job === null ? null : $this->assignedManager($worker, $job);
        $selectedManager = $manager;
        if ($manager === null && $job !== null) {
            $manager = $this->validManager($job->creator()->first());
            if ($manager !== null) {
                $recipients->push($this->recipient($manager, 'dispatch_creator'));
                $selectedManager = $manager;
            }
        } elseif ($manager !== null) {
            $recipients->push($this->recipient($manager, 'assignment_manager'));
        }

        if ($selectedManager === null) {
            User::query()
                ->role(RoleName::OperationsManager->value)
                ->where('is_active', true)
                ->whereNull('suspended_at')
                ->whereNotNull('email_verified_at')
                ->get()
                ->each(fn (User $user) => $recipients->push($this->recipient($user, 'operations_manager_fallback')));
        }

        User::query()
            ->role(RoleName::OperationsManager->value)
            ->where('is_active', true)
            ->whereNull('suspended_at')
            ->whereNotNull('email_verified_at')
            ->get()
            ->each(fn (User $user) => $recipients->push($this->recipient($user, 'operations_manager')));

        return $recipients->unique(fn (array $item): int => $item['user']->id)->values();
    }

    private function assignedManager(User $worker, DispatchJob $job): ?User
    {
        $assignment = DispatchPersonnelAssignment::query()
            ->where('dispatch_job_id', $job->id)
            ->where('user_id', $worker->id)
            ->active()
            ->latest('id')
            ->first();

        return $assignment === null
            ? null
            : $this->validManager(User::query()->find($assignment->assigned_by));
    }

    private function validManager(?User $user): ?User
    {
        return $user !== null
            && $user->is_active
            && $user->suspended_at === null
            && $user->email_verified_at !== null
            && $user->hasRole(RoleName::OperationsManager->value)
            ? $user
            : null;
    }

    /** @return array{user: User, role_at_alert: string, resolution_reason: string} */
    private function recipient(User $user, string $reason): array
    {
        $role = $user->operationalRole();

        return [
            'user' => $user,
            'role_at_alert' => $role === null ? RoleName::OperationsManager->value : $role->value,
            'resolution_reason' => $reason,
        ];
    }
}
