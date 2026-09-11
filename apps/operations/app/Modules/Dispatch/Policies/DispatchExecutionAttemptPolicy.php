<?php

namespace App\Modules\Dispatch\Policies;

use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Services\DispatchV2Authorization;
use App\Platform\Identity\Models\User;
use Throwable;

final class DispatchExecutionAttemptPolicy
{
    public function __construct(private readonly DispatchV2Authorization $authorization) {}

    public function view(User $user, DispatchExecutionAttempt $attempt): bool
    {
        return $this->allows(function () use ($user, $attempt): void {
            $this->authorization->authorizeRead($user, $attempt);
        });
    }

    public function submit(User $user, DispatchExecutionAttempt $attempt): bool
    {
        return $this->allows(function () use ($user, $attempt): void {
            $this->authorization->authorize($user, 'submit', $attempt);
        });
    }

    public function approve(User $user, DispatchExecutionAttempt $attempt): bool
    {
        return $this->allows(function () use ($user, $attempt): void {
            $this->authorization->authorize($user, 'approve', $attempt);
        });
    }

    public function dispatch(User $user, DispatchExecutionAttempt $attempt): bool
    {
        return $this->allows(function () use ($user, $attempt): void {
            $this->authorization->authorize($user, 'dispatch', $attempt);
        });
    }

    public function progress(User $user, DispatchExecutionAttempt $attempt): bool
    {
        return $this->allows(function () use ($user, $attempt): void {
            $this->authorization->authorize($user, 'progress', $attempt);
        });
    }

    public function cancel(User $user, DispatchExecutionAttempt $attempt): bool
    {
        return $this->allows(function () use ($user, $attempt): void {
            $this->authorization->authorize($user, 'cancel', $attempt);
        });
    }

    public function reopen(User $user, DispatchExecutionAttempt $attempt): bool
    {
        return $this->allows(function () use ($user, $attempt): void {
            $this->authorization->authorize($user, 'reopen', $attempt);
        });
    }

    public function archive(User $user, DispatchExecutionAttempt $attempt): bool
    {
        return $this->allows(function () use ($user, $attempt): void {
            $this->authorization->authorize($user, 'archive', $attempt);
        });
    }

    /** @param  callable(): void  $callback */
    private function allows(callable $callback): bool
    {
        try {
            $callback();

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
