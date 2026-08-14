<?php

namespace App\Modules\Dispatch\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Actions\ActivateDispatchJob;
use App\Modules\Dispatch\Actions\ArchiveDispatchJob;
use App\Modules\Dispatch\Actions\CancelDispatchJob;
use App\Modules\Dispatch\Actions\ReopenDispatchJob;
use App\Modules\Dispatch\Actions\RestoreDispatchJob;
use App\Modules\Dispatch\Actions\TransitionDispatchJob;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Http\Requests\ActivateDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\ArchiveDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\CancelDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\ReopenDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\RestoreDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\TransitionDispatchJobRequest;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Shared\Http\Exceptions\VersionConflictException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;

final class DispatchWorkflowController extends Controller
{
    public function activate(
        ActivateDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        ActivateDispatchJob $action,
        DispatchV2Commands $commands,
    ): RedirectResponse {
        $expectedVersion = (int) $request->validated('version');
        $attempt = $this->resolveV2Attempt($dispatchJob);

        if (config('dispatch.v2_commands_enabled') && $attempt !== null && $attempt->planVersions()->whereIn('status', ['approved', 'submitted'])->exists()) {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                reason: 'Activated via web workflow',
            );

            try {
                $commands->dispatch($request->user(), $attempt, $mutation);
                $dispatchJob->update([
                    'status' => DispatchStatus::Dispatched,
                    'activated_by' => $request->user()->id,
                    'version' => $attempt->fresh()->version,
                ]);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $dispatchJob, $attempt);
            }
        } else {
            $action->handle($request->user(), $dispatchJob, $expectedVersion);
            if ($attempt !== null) {
                $attempt->update([
                    'status' => DispatchAttemptStatus::Dispatched,
                    'activated_by' => $request->user()->id,
                    'version' => $dispatchJob->fresh()->version,
                ]);
            }
        }

        return to_route('dispatch-jobs.show', $dispatchJob)->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$dispatchJob->reference} was activated.",
        ]);
    }

    public function cancel(
        CancelDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        CancelDispatchJob $action,
        DispatchV2Commands $commands,
    ): RedirectResponse {
        $expectedVersion = (int) $request->validated('version');
        $reason = (string) $request->validated('reason');
        $attempt = $this->resolveV2Attempt($dispatchJob);

        if (config('dispatch.v2_commands_enabled') && $attempt !== null) {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                reason: $reason,
            );

            try {
                $commands->cancel($request->user(), $attempt, $mutation);
                $dispatchJob->update([
                    'status' => DispatchStatus::Cancelled,
                    'cancelled_by' => $request->user()->id,
                    'cancellation_reason' => $reason,
                    'version' => $attempt->fresh()->version,
                ]);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $dispatchJob, $attempt);
            }

            $job = $dispatchJob->fresh();
        } else {
            $job = $action->handle(
                $request->user(),
                $dispatchJob,
                $reason,
                $expectedVersion,
            );
        }

        return to_route('dispatch-jobs.show', $job)->with('flash', [
            'tone' => 'warning',
            'message' => "Dispatch {$job->reference} was cancelled.",
        ]);
    }

    public function reopen(
        ReopenDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        ReopenDispatchJob $action,
        DispatchV2Commands $commands,
    ): RedirectResponse {
        $expectedVersion = (int) $request->validated('version');
        $reason = (string) $request->validated('reason');
        $attempt = $this->resolveV2Attempt($dispatchJob);

        if (config('dispatch.v2_commands_enabled') && $attempt !== null) {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                reason: $reason,
            );

            try {
                $newAttempt = $commands->reopen($request->user(), $attempt, $mutation);
                $dispatchJob->update([
                    'status' => DispatchStatus::Draft,
                    'cancelled_by' => null,
                    'cancellation_reason' => null,
                    'version' => $newAttempt->version,
                ]);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $dispatchJob, $attempt);
            }

            $job = $dispatchJob->fresh();
        } else {
            $job = $action->handle(
                $request->user(),
                $dispatchJob,
                $reason,
                $expectedVersion,
            );
        }

        return to_route('dispatch-jobs.show', $job)->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$job->reference} was reopened as draft.",
        ]);
    }

    public function archive(
        ArchiveDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        ArchiveDispatchJob $action,
        DispatchV2Commands $commands,
    ): RedirectResponse {
        $attempt = $this->resolveV2Attempt($dispatchJob);
        $reason = $request->validated('reason');

        if (config('dispatch.v2_commands_enabled') && $attempt !== null) {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $attempt->version,
                reason: $reason,
            );

            try {
                $commands->archive($request->user(), $attempt, $mutation);
                $dispatchJob->delete();
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $dispatchJob, $attempt);
            }
        } else {
            $action->handle(
                $request->user(),
                $dispatchJob,
                $reason,
            );
        }

        return to_route('home')->with('flash', [
            'tone' => 'info',
            'message' => "Dispatch {$dispatchJob->reference} was archived.",
        ]);
    }

    public function restore(
        RestoreDispatchJobRequest $request,
        int $dispatchJob,
        RestoreDispatchJob $action,
    ): RedirectResponse {
        $job = $action->handle(
            $request->user(),
            $dispatchJob,
            $request->validated('reason'),
        );

        return to_route('dispatch-jobs.show', $job)->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$job->reference} was restored.",
        ]);
    }

    public function transition(
        TransitionDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        TransitionDispatchJob $action,
        DispatchV2Commands $commands,
    ): RedirectResponse {
        $statusStr = (string) $request->validated('status');
        $expectedVersion = (int) $request->validated('version');
        $attempt = $this->resolveV2Attempt($dispatchJob);

        if (config('dispatch.v2_commands_enabled') && $attempt !== null) {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                reason: 'Transitioned via web workflow',
            );

            try {
                if (in_array($statusStr, ['en_route', 'arrived', 'working', 'completed'], true)) {
                    $attemptStatus = match ($statusStr) {
                        'en_route' => DispatchAttemptStatus::EnRoute,
                        'arrived' => DispatchAttemptStatus::Arrived,
                        'working' => DispatchAttemptStatus::Working,
                        'completed' => DispatchAttemptStatus::Completed,
                    };

                    $commands->progress($request->user(), $attempt, $attemptStatus, $mutation);
                    $dispatchJob->update([
                        'status' => DispatchStatus::from($statusStr),
                        'version' => $attempt->fresh()->version,
                    ]);
                }
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $dispatchJob, $attempt);
            }

            $job = $dispatchJob->fresh();
        } else {
            $job = $action->handle(
                $request->user(),
                $dispatchJob,
                DispatchStatus::from($statusStr),
                $expectedVersion,
            );
        }

        return to_route('dispatch-jobs.show', $job)->with('flash', [
            'tone' => 'info',
            'message' => "Dispatch {$job->reference} is now {$job->status->label()}.",
        ]);
    }

    private function resolveV2Attempt(DispatchJob $job): ?DispatchExecutionAttempt
    {
        return $job->canonicalHandoff?->attempts()->latest('attempt_number')->first()
            ?? $job->currentAttempt
            ?? $job->attempts()->latest('attempt_number')->first();
    }

    private function handleCommandException(
        DispatchV2CommandException $e,
        DispatchJob $dispatchJob,
        DispatchExecutionAttempt $attempt,
    ): never {
        if ($e->getErrorCode() === DispatchV2CommandCode::StaleVersion) {
            throw new VersionConflictException(
                $e->getMessage(),
                $attempt->fresh()->version,
            );
        }

        if ($e->getErrorCode() === DispatchV2CommandCode::Forbidden) {
            abort(403, $e->getMessage());
        }

        throw ValidationException::withMessages([
            'status' => [$e->getMessage()],
        ]);
    }
}
